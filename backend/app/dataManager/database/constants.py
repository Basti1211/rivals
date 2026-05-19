TASK_SELECT = [
    "task_id",
    "task_name",
    "dataset",
    "task_group",
    "finished_after_correct_answer",
    "hint_video",
    "hint_video_path",
    "hint_video_start_time",
    "hint_video_end_time",
    "hint_text",
    "target_text",
    "target_video",
    "target_video_path",
    "target_video_start_time",
    "target_video_end_time",
    "task_start_time",
    "task_end_time",
    "from_file",
]

USER_SELECT = [
    "user_name",
    "system_name",
    "hierarchy",
    "from_file",
]

SUBMISSION_SELECT = [
    "task_name",
    "user_name",
    "time",
    "status",
    "answer_text",
    "answer_video",
    "answer_video_start_time",
    "answer_video_end_time",
    "from_file",
]

INTERACTION_SELECT = [
    "time",
    "type",
    "frame_rank",
    "video_rank",
    "metadata",
    "from_file",
]

SOURCE_FILE_DATA_TABLES = [
    "Answers",
    "Interactions",
    "Tasks",
    "Users",
]

DATABASE_PRAGMA_QUERIES = [
    "PRAGMA foreign_keys = ON;",
    "PRAGMA journal_mode = WAL;",
    "PRAGMA busy_timeout = 5000;",
]

DATABASE_HEALTH_CHECK_QUERY = "SELECT 1"

COUNT_TABLE_ROWS_QUERY = "SELECT COUNT(*) AS count FROM {table_name}"

CREATE_TABLE_QUERIES = [
    """
    CREATE TABLE IF NOT EXISTS SourceFiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS Tasks (
        task_name TEXT PRIMARY KEY,
        task_id TEXT,
        task_group TEXT,
        task_start_time INTEGER,
        task_end_time INTEGER,
        finished_after_correct_answer INTEGER NOT NULL DEFAULT 0,
        dataset TEXT,
        type TEXT,
        hint TEXT,
        hint_text TEXT,
        hint_video TEXT,
        hint_video_path TEXT,
        hint_video_start_time INTEGER,
        hint_video_end_time INTEGER,
        target_text TEXT,
        target_video TEXT,
        target_video_path TEXT,
        target_video_start_time INTEGER,
        target_video_end_time INTEGER,
        from_file INTEGER,
        FOREIGN KEY (from_file) REFERENCES SourceFiles(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS Answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT,
        user_name TEXT,
        time INTEGER,
        status INTEGER,
        answer_text TEXT,
        answer_video TEXT,
        answer_video_start_time INTEGER,
        answer_video_end_time INTEGER,
        from_file INTEGER,
        FOREIGN KEY (from_file) REFERENCES SourceFiles(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS Interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        time INTEGER,
        type TEXT,
        frame_rank INTEGER,
        video_rank INTEGER,
        metadata TEXT,
        from_file INTEGER,
        FOREIGN KEY (from_file) REFERENCES SourceFiles(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS Users (
        user_name TEXT PRIMARY KEY,
        system_name TEXT,
        hierarchy TEXT,
        from_file INTEGER,
        FOREIGN KEY (from_file) REFERENCES SourceFiles(id)
    );
    """,
]

CREATE_INDEX_QUERIES = [
    """
    CREATE INDEX IF NOT EXISTS idx_answers_task_name
    ON Answers(task_name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_answers_user_name
    ON Answers(user_name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_interactions_user_name
    ON Interactions(user_name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_interactions_time
    ON Interactions(time);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_tasks_from_file
    ON Tasks(from_file);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_answers_from_file
    ON Answers(from_file);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_interactions_from_file
    ON Interactions(from_file);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_users_from_file
    ON Users(from_file);
    """,
]

COUNT_TABLES = {
    "tasks": "Tasks",
    "users": "Users",
    "logs": "Interactions",
    "answers": "Answers",
    "sourceFiles": "SourceFiles",
}
