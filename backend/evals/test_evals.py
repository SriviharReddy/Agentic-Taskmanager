import pytest
from datetime import datetime, timezone
import difflib
from backend.app.schemas.task import ExtractedTaskSchema

def test_relative_fuzzy_deduplication():
    """Verify that similar task descriptions exceed the deduplication threshold."""
    existing_title = "Submit quarterly tax paperwork"
    candidate_1 = "Submit quarterly taxes"
    candidate_2 = "Buy groceries for dinner"
    
    sim_1 = difflib.SequenceMatcher(None, existing_title.lower(), candidate_1.lower()).ratio()
    sim_2 = difflib.SequenceMatcher(None, existing_title.lower(), candidate_2.lower()).ratio()
    
    assert sim_1 >= 0.65, f"Expected duplicate similarity >= 0.65, got {sim_1}"
    assert sim_2 < 0.40, f"Expected unrelated similarity < 0.40, got {sim_2}"

def test_extracted_task_schema_validation():
    """Verify Pydantic v2 validation for extracted tasks."""
    task_data = {
        "title": "Review Q3 financial report",
        "description": "Ensure EBITDA margins match projections",
        "priority": 1,
        "eisenhower_quadrant": "do_first",
        "due_date_iso": "2026-09-01T15:00:00Z",
        "estimated_minutes": 45,
        "tags": ["finance", "work"],
        "subtasks": ["Download PDF", "Check variance", "Email CFO"],
        "source_context": "From Slack message: 'Review Q3 report by Tuesday'"
    }
    
    model = ExtractedTaskSchema(**task_data)
    assert model.title == "Review Q3 financial report"
    assert model.priority == 1
    assert model.eisenhower_quadrant == "do_first"
    assert len(model.subtasks) == 3
    assert "finance" in model.tags

def test_eisenhower_quadrant_mapping():
    """Verify proper quadrant derivation from priority levels."""
    def get_quadrant(priority: int) -> str:
        mapping = {1: "do_first", 2: "schedule", 3: "delegate", 4: "eliminate"}
        return mapping.get(priority, "schedule")

    assert get_quadrant(1) == "do_first"
    assert get_quadrant(2) == "schedule"
    assert get_quadrant(3) == "delegate"
    assert get_quadrant(4) == "eliminate"
