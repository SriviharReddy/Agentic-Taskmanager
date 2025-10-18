# Agentic Task Manager

An AI-powered task manager that uses Google's Gemini to extract tasks from text, URLs, and screenshots. The application proactively scans content for events, deadlines, and actionable items, suggesting them as tasks for you to manage.

## Features

- **Natural Language Interface**: Chat with the AI assistant to manage your tasks
- **URL Processing**: Provide URLs and the system will scan for actionable items
- **Screenshot Analysis**: Upload screenshots and the system will extract text to find tasks
- **Task Management**: Add, list, and complete tasks
- **AI-Powered Extraction**: Automatically detects deadlines, events, and actions from provided content
- **Persistent Storage**: Tasks are stored in a local SQLite database

## Tech Stack

- Streamlit (UI Framework)
- LangChain (AI Agent Framework)
- Google's Gemini 2.5 Flash (AI Model)
- EasyOCR (Text extraction from images)
- Trafilatura (Web content extraction)
- SQLite (Task storage)
- Python

## Installation

1. Clone the repository:
```bash
git clone https://github.com/SriviharReddy/Agentic-Taskmanager.git
cd Agentic-Taskmanager
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
venv\Scripts\activate  # On Windows
source venv/bin/activate  # On macOS/Linux
```

3. Install the required dependencies:
```bash
pip install -r requirements.txt
```

4. Set up your Google API key:
   - Get an API key from [Google AI Studio](https://aistudio.google.com/)
   - Create a `.env` file in the project root
   - Add your API key to the `.env` file:
```
GOOGLE_API_KEY="your_api_key_here"
```

## Usage

1. Run the application:
```bash
streamlit run app.py
```

2. The application will open in your browser at `http://localhost:8501`

3. Use the chat interface to:
   - Add tasks manually
   - Provide URLs for automatic task extraction
   - Upload screenshots for task extraction
   - List and complete existing tasks

## How It Works

The Agentic Task Manager uses a LangChain agent with Google's Gemini model to understand user requests and automatically extract tasks from various sources. The agent has several tools:

- `add_task`: Adds new tasks to the database
- `list_pending_tasks`: Shows all pending tasks
- `complete_task`: Marks tasks as completed
- `read_text_from_screenshot`: Extracts text from uploaded images
- `scrape_text_from_url`: Extracts text from web pages

## Architecture

- `app.py`: Main Streamlit application with the UI and agent integration
- `database.py`: SQLite-based task management system
- `.env`: Environment variables (not included in repository for security)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.