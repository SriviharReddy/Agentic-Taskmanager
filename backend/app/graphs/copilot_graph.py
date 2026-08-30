import os
from datetime import datetime, timezone
from typing import Literal

from langchain_core.messages import SystemMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from backend.app.core.config import settings, get_chat_model
from backend.app.graphs.state import CopilotState
from backend.app.graphs.tools import all_task_tools

COPILOT_SYSTEM_PROMPT = """You are the AI Task Copilot & Executive Assistant inside the Agentic Task Manager.
You have direct access to tools for creating, listing, searching, updating, completing, deleting, and breaking down tasks.

Your goals:
1. Help the user stay organized, focused, and stress-free.
2. Be proactive: when the user mentions todos or errands, extract details (priority, deadline, tags, subtasks) and call `create_task`.
3. When the user asks for a review or what to work on next, use `list_tasks` and prioritize effectively using the Eisenhower Matrix (P1: Urgent/Important, P2: Important, P3: Urgent, P4: Low).
4. When a task seems daunting or large, offer or automatically use `breakdown_task` to add 3-5 concrete steps.
5. If the user marks something done or asks to complete it, call `complete_task`.
6. Reference timestamps: Today's reference UTC time is {current_time_iso}. User timezone is {user_timezone}.
7. Keep responses concise, clear, and action-oriented. Use clean Markdown with bullet points, bold task names, and emojis where appropriate.
"""

async def call_model(state: CopilotState) -> dict:
    """Invokes the chat model asynchronously with tools attached."""
    current_time_iso = datetime.now(timezone.utc).isoformat()
    user_tz = state.get("timezone", "UTC")
    
    sys_prompt = COPILOT_SYSTEM_PROMPT.format(
        current_time_iso=current_time_iso,
        user_timezone=user_tz
    )
    
    llm = get_chat_model(temperature=0.2)
    model_with_tools = llm.bind_tools(all_task_tools)
    
    messages = [SystemMessage(content=sys_prompt)] + state["messages"]
    response = await model_with_tools.ainvoke(messages)
    return {"messages": [response]}

async def execute_tools(state: CopilotState) -> dict:
    """Executes tool calls asynchronously and returns ToolMessages."""
    last_message = state["messages"][-1]
    tool_messages = []
    tools_by_name = {t.name: t for t in all_task_tools}
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        for tc in last_message.tool_calls:
            tool_name = tc.get("name")
            tool_args = tc.get("args", {})
            tool_id = tc.get("id")
            
            tool_fn = tools_by_name.get(tool_name)
            if tool_fn:
                try:
                    res = await tool_fn.ainvoke(tool_args)
                    tool_messages.append(ToolMessage(content=str(res), tool_call_id=tool_id, name=tool_name))
                except Exception as e:
                    tool_messages.append(ToolMessage(content=f"Error executing {tool_name}: {str(e)}", tool_call_id=tool_id, name=tool_name))
            else:
                tool_messages.append(ToolMessage(content=f"Tool {tool_name} not found", tool_call_id=tool_id, name=tool_name))
                
    return {"messages": tool_messages}

def should_continue(state: CopilotState) -> Literal["tools", "__end__"]:
    """Determines whether the model requested tool calls or is ready to finish."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END

# Build StateGraph
workflow = StateGraph(CopilotState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", execute_tools)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue, ["tools", END])
workflow.add_edge("tools", "agent")

# Checkpointer for conversation state
copilot_checkpointer = MemorySaver()
copilot_graph = workflow.compile(checkpointer=copilot_checkpointer)
