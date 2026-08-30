import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.app.core.database import init_db

@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "Agentic Task Manager" in data["service"]

@pytest.mark.asyncio
async def test_task_lifecycle_crud():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create task
        create_payload = {
            "title": "Build AI evaluation benchmark suite",
            "description": "Evaluate LangGraph extraction accuracy and latency",
            "priority": 1,
            "estimated_minutes": 60,
            "tags": ["ai", "benchmark"],
            "subtasks": ["Create test dataset", "Run LLM-as-a-judge", "Record metrics"]
        }
        res = await client.post("/api/v1/tasks", json=create_payload)
        assert res.status_code == 200
        task_data = res.json()
        task_id = task_data["id"]
        assert task_data["title"] == create_payload["title"]
        assert task_data["priority"] == 1
        assert task_data["eisenhower_quadrant"] == "do_first"
        assert len(task_data["subtasks"]) == 3
        assert len(task_data["tags"]) == 2

        # 2. Get task by ID
        get_res = await client.get(f"/api/v1/tasks/{task_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == task_id

        # 3. Update task status to done
        patch_res = await client.patch(f"/api/v1/tasks/{task_id}", json={"status": "done"})
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "done"
        assert patch_res.json()["completed_at"] is not None

        # 4. Add a subtask
        sub_res = await client.post(f"/api/v1/tasks/{task_id}/subtasks", json={"title": "Publish results", "is_completed": False})
        assert sub_res.status_code == 200
        assert sub_res.json()["title"] == "Publish results"

        # 5. List tasks
        list_res = await client.get("/api/v1/tasks?status=done")
        assert list_res.status_code == 200
        assert any(t["id"] == task_id for t in list_res.json()["tasks"])

        # 6. Delete task
        del_res = await client.delete(f"/api/v1/tasks/{task_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

@pytest.mark.asyncio
async def test_tools_direct_execution():
    import re
    from backend.app.graphs.tools import create_task, list_tasks, update_task, complete_task, breakdown_task, delete_task
    await init_db()
    
    # 1. create_task tool
    res = await create_task.ainvoke({
        "title": "Direct tool test task",
        "description": "Created via LangChain tool",
        "priority": 2,
        "tags": ["unit-test"],
        "subtasks": ["Step A", "Step B"]
    })
    assert "Successfully created task" in res
    
    m = re.search(r"#(\d+)", res)
    assert m is not None
    tid = int(m.group(1))
    
    # 2. list_tasks tool
    list_out = await list_tasks.ainvoke({"status": "todo", "search_query": "Direct tool test"})
    assert f"#{tid}" in list_out
    
    # 3. breakdown_task tool
    bd_out = await breakdown_task.ainvoke({"task_id": tid, "steps": ["Step C", "Step D"]})
    assert "Added 2 subtasks" in bd_out
    
    # 4. update_task tool
    up_out = await update_task.ainvoke({"task_id": tid, "priority": 1, "title": "Updated direct task"})
    assert "updated successfully" in up_out
    
    # 5. complete_task tool
    comp_out = await complete_task.ainvoke({"task_id": tid})
    assert "marked as completed" in comp_out
    
    # 6. delete_task tool
    del_out = await delete_task.ainvoke({"task_id": tid})
    assert "has been deleted" in del_out

@pytest.mark.asyncio
async def test_ingestion_graph_hitl_interrupt_and_resume():
    from unittest.mock import patch, MagicMock, AsyncMock
    from backend.app.graphs.ingestion_graph import ingestion_graph
    from backend.app.schemas.task import ExtractedTaskSchema, ExtractedTaskList
    from langgraph.types import Command
    await init_db()
    
    thread_id = "test_hitl_thread_mock_1"
    config = {"configurable": {"thread_id": thread_id}}
    
    tasks_mock = [
        ExtractedTaskSchema(title="Task Alpha", priority=1, eisenhower_quadrant="do_first", estimated_minutes=15, tags=["work"], subtasks=[]),
        ExtractedTaskSchema(title="Task Beta", priority=2, eisenhower_quadrant="schedule", estimated_minutes=30, tags=["work"], subtasks=[]),
        ExtractedTaskSchema(title="Task Gamma", priority=3, eisenhower_quadrant="delegate", estimated_minutes=45, tags=["errand"], subtasks=[]),
    ]
    mock_structured = MagicMock()
    mock_structured.ainvoke = AsyncMock(return_value=ExtractedTaskList(tasks=tasks_mock))
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    
    initial_state = {
        "input_text": "Task Alpha, Task Beta, Task Gamma",
        "input_url": None,
        "input_image_base64": None,
        "input_audio_base64": None,
        "timezone": "UTC",
        "raw_content": None,
        "extracted_tasks": [],
        "duplicates_detected": [],
        "needs_human_approval": False,
        "approval_result": None,
        "approved_tasks": [],
        "committed_task_ids": [],
        "status": "init",
        "message": ""
    }
    
    with patch("backend.app.graphs.ingestion_graph.get_chat_model", return_value=mock_llm):
        res = await ingestion_graph.ainvoke(initial_state, config=config)
        graph_state = await ingestion_graph.aget_state(config)
        
        has_interrupt = bool(
            (hasattr(graph_state, "interrupts") and graph_state.interrupts)
            or (graph_state.tasks and any(task.interrupts for task in graph_state.tasks))
            or res.get("__interrupt__")
        )
        assert has_interrupt is True
        
        # Resume with approval
        resume_payload = {"approved": True, "tasks": None}
        res_after = await ingestion_graph.ainvoke(Command(resume=resume_payload), config=config)
        assert res_after.get("status") == "completed"
        assert len(res_after.get("committed_task_ids", [])) == 3

@pytest.mark.asyncio
async def test_api_ingest_and_resume_flow():
    from unittest.mock import patch, MagicMock, AsyncMock
    from backend.app.schemas.task import ExtractedTaskSchema, ExtractedTaskList
    await init_db()
    
    tasks_mock = [
        ExtractedTaskSchema(title="Security Audit", priority=1, eisenhower_quadrant="do_first", estimated_minutes=60, tags=["security"], subtasks=[]),
        ExtractedTaskSchema(title="Performance Profile", priority=2, eisenhower_quadrant="schedule", estimated_minutes=45, tags=["backend"], subtasks=[]),
        ExtractedTaskSchema(title="Update Docs", priority=3, eisenhower_quadrant="delegate", estimated_minutes=20, tags=["docs"], subtasks=[]),
    ]
    mock_structured = MagicMock()
    mock_structured.ainvoke = AsyncMock(return_value=ExtractedTaskList(tasks=tasks_mock))
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("backend.app.graphs.ingestion_graph.get_chat_model", return_value=mock_llm):
            # 1. Post to /api/v1/ingest
            resp = await client.post("/api/v1/ingest", json={"text": "Audit, Profile, Docs"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "interrupted_review_needed"
            thread_id = data["thread_id"]
            assert len(data["tasks_extracted"]) == 3
            
            # 2. Resume interrupt with approval
            resume_resp = await client.post("/api/v1/ingest/resume", json={
                "thread_id": thread_id,
                "approved": True
            })
            assert resume_resp.status_code == 200
            resume_data = resume_resp.json()
            assert resume_data["status"] == "completed"
            assert len(resume_data["tasks_extracted"]) == 3

@pytest.mark.asyncio
async def test_chat_sse_stream():
    from langchain_core.messages import AIMessageChunk
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test chat stream initialization
        resp = await client.post("/api/v1/chat/stream", json={"message": "Hello copilot!"})
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
