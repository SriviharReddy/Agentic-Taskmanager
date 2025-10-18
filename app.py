# app.py
import streamlit as st
import os
from dotenv import load_dotenv

# --- LangChain & Gemini Imports ---
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent, tool
from langchain_core.prompts import ChatPromptTemplate

# --- Other Tool Imports ---
import easyocr
import requests
from trafilatura import fetch_url, extract
from database import TaskManager
from io import BytesIO

# --- Setup ---
load_dotenv() # Load environment variables from .env file
st.set_page_config(page_title="Agentic Task Manager", layout="wide")
st.title("🤖 Agentic Task Manager (with Gemini)")

# Initialize database and task manager
if 'db' not in st.session_state:
    st.session_state.db = TaskManager()

# Initialize Gemini LLM
# Make sure to set GOOGLE_API_KEY in your .env file
if "GOOGLE_API_KEY" not in os.environ:
    st.error("GOOGLE_API_KEY not found in environment variables. Please set it in a .env file.")
    st.stop()
    
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# --- Agent Tools (NO CHANGES HERE) ---
@tool
def add_task(description: str) -> str:
    """Adds a new task to the database. Use this when the user explicitly asks to add a task or when you find a task-like action in text."""
    task_id = st.session_state.db.add_task(description)
    return f"Added task '{description}' with ID {task_id}."

@tool
def list_pending_tasks() -> str:
    """Lists all tasks that are not yet completed."""
    tasks = st.session_state.db.get_tasks(status='pending')
    if not tasks:
        return "You have no pending tasks."
    return "\n".join([f"ID: {t[0]}, Task: {t[1]}" for t in tasks])

@tool
def complete_task(task_id: int) -> str:
    """Marks a task as completed by its ID. Ask the user for the ID if they don't provide it."""
    if st.session_state.db.complete_task(task_id):
        return f"Marked task {task_id} as complete."
    else:
        return f"Could not find a pending task with ID {task_id}."

@tool
def read_text_from_screenshot(image_bytes: bytes) -> str:
    """Reads all text from an image file. Use this when the user uploads a screenshot."""
    reader = easyocr.Reader(['en'])
    image = BytesIO(image_bytes)
    results = reader.readtext(image.read())
    text = " ".join([result[1] for result in results])
    return text

@tool
def scrape_text_from_url(url: str) -> str:
    """Extracts the main text content from a web page URL."""
    downloaded = fetch_url(url)
    if downloaded is None:
        return f"Could not retrieve content from {url}."
    text = extract(downloaded)
    return text if text else "Could not extract text from the page."

# --- Agent Initialization (NO CHANGES HERE) ---
tools = [add_task, list_pending_tasks, complete_task, read_text_from_screenshot, scrape_text_from_url]

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant task manager. Your goal is to help the user manage their tasks.
    You can add tasks, list them, and mark them as complete.
    When a user provides a URL or screenshot, your primary goal is to proactively scan the content for any events, deadlines, or actionable items and suggest them as tasks.
    Always confirm with the user before adding a task you've found.
    Use the provided tools to accomplish these goals."""),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# --- Sidebar for Task List ---
with st.sidebar:
    st.header("📋 Your Tasks")
    if st.button("Refresh Tasks"):
        st.rerun()
    
    pending_tasks = st.session_state.db.get_tasks(status='pending')
    completed_tasks = st.session_state.db.get_tasks(status='completed')

    st.subheader("Pending")
    for task in pending_tasks:
        cols = st.columns([0.8, 0.2])
        with cols[0]:
            st.write(f"• {task[1]}")
        with cols[1]:
            if st.button("✅", key=f"complete_{task[0]}"):
                st.session_state.db.complete_task(task[0])
                st.rerun()

    st.subheader("Completed")
    for task in completed_tasks:
        st.write(f"~~{task[1]}~~")

# --- Chat Interface ---
if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# User input
if prompt := st.chat_input("Ask me anything, give me a URL, or upload a screenshot..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        # Handle different input types
        image_data = None
        
        # Check for uploaded file
        if "image" in st.session_state and st.session_state.image is not None:
            image_data = st.session_state.image.getvalue()
            st.session_state.image = None # Clear after use

        # Prepare input for the agent
        agent_input = {"input": prompt}
        if image_data:
            agent_input["image_bytes"] = image_data
            
        response = agent_executor.invoke(agent_input)
        st.markdown(response['output'])
        st.session_state.messages.append({"role": "assistant", "content": response['output']})

# File uploader for screenshots
uploaded_file = st.file_uploader("Upload a screenshot", type=["png", "jpg", "jpeg"])
if uploaded_file:
    st.session_state.image = uploaded_file
    st.success("Screenshot uploaded! Now send a message in the chat to process it.")