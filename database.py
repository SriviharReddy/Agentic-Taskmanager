# database.py
import sqlite3
from datetime import datetime
import threading

class TaskManager:
    def __init__(self, db_name="tasks.db"):
        self.db_name = db_name
        self.local = threading.local()
        self._create_table()

    def _get_connection(self):
        if not hasattr(self.local, 'conn'):
            self.local.conn = sqlite3.connect(self.db_name)
        return self.local.conn

    def _create_table(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

    def add_task(self, description, source=None):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO tasks (description, source) VALUES (?, ?)", (description, source))
        conn.commit()
        return cursor.lastrowid

    def get_tasks(self, status=None):
        conn = self._get_connection()
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT id, description, status, created_at FROM tasks WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cursor.execute("SELECT id, description, status, created_at FROM tasks ORDER BY created_at DESC")
        return cursor.fetchall()

    def complete_task(self, task_id):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_id,))
        conn.commit()
        return cursor.rowcount > 0

    def close(self):
        if hasattr(self.local, 'conn'):
            self.local.conn.close()