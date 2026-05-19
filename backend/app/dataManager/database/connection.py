import logging
import os
import sqlite3
from contextlib import contextmanager
from threading import RLock
from typing import Any, Generator, Iterable, Optional

from app.dataManager.database.constants import (
    COUNT_TABLE_ROWS_QUERY,
    COUNT_TABLES,
    CREATE_INDEX_QUERIES,
    CREATE_TABLE_QUERIES,
    DATABASE_HEALTH_CHECK_QUERY,
    DATABASE_PRAGMA_QUERIES,
)

logger = logging.getLogger(__name__)


DB_PATH = os.getenv("DB_PATH", "/data/app.db")

_connection: Optional[sqlite3.Connection] = None
_connection_lock = RLock()


def database_connect(db_path: Optional[str] = None) -> None:
    """
    Initialize the global SQLite connection and create tables.
    """

    global _connection

    with _connection_lock:
        if _connection is not None:
            return

        path = db_path or DB_PATH

        if path != ":memory:":
            directory = os.path.dirname(path)
            if directory:
                os.makedirs(directory, exist_ok=True)

        try:
            logger.info("Connecting to SQLite database: %s", path)

            _connection = sqlite3.connect(
                path,
                check_same_thread=False,
            )

            _connection.row_factory = sqlite3.Row

            _configure_database(_connection)
            _initialize_tables(_connection)

            logger.info("SQLite database initialized")

        except Exception:
            logger.exception("Failed to initialize SQLite database")
            _connection = None
            raise


def database_dispose() -> None:
    """
    Close the global SQLite connection.

    Call this when your application shuts down.
    """

    global _connection

    with _connection_lock:
        if _connection is not None:
            logger.info("Closing SQLite database connection")
            _connection.close()
            _connection = None


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager yielding the active SQLite connection.

    Example:
        with get_connection() as conn:
            rows = conn.execute("SELECT * FROM Users").fetchall()
    """

    global _connection

    if _connection is None:
        database_connect()

    if _connection is None:
        raise RuntimeError("Database connection not initialized")

    with _connection_lock:
        try:
            yield _connection
            _connection.commit()
        except Exception:
            _connection.rollback()
            raise


def check_db_connection() -> bool:
    """
    Validate that the SQLite database connection is usable.
    """

    try:
        with get_connection() as conn:
            conn.execute(DATABASE_HEALTH_CHECK_QUERY)
        return True
    except Exception:
        logger.exception("Database health check failed")
        raise


def fetch(sql: str, params: Optional[tuple[Any, ...]] = None) -> list[dict[str, Any]]:
    """
    Execute a SELECT query and return rows as dictionaries.
    """

    with get_connection() as conn:
        cursor = conn.execute(sql, params or ())
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def insert(sql: str, params: Optional[tuple[Any, ...]] = None) -> int:
    """
    Execute an INSERT, UPDATE, DELETE, or REPLACE statement.
    Returns the last inserted row id.
    """

    with get_connection() as conn:
        cursor = conn.execute(sql, params or ())
        return cursor.lastrowid


def insert_many(sql: str, params: Iterable[tuple[Any, ...]]) -> int:
    """
    Execute one INSERT, UPDATE, DELETE, or REPLACE statement for many rows.
    Returns the number of affected rows reported by SQLite.
    """

    with get_connection() as conn:
        cursor = conn.executemany(sql, params)
        return cursor.rowcount


def _configure_database(conn: sqlite3.Connection) -> None:
    """
    Configure SQLite behavior.
    """

    for query in DATABASE_PRAGMA_QUERIES:
        conn.execute(query)

    conn.commit()


def _initialize_tables(conn: sqlite3.Connection) -> None:
    """
    Create all required tables if they do not exist.
    """

    for query in CREATE_TABLE_QUERIES:
        conn.execute(query)

    for query in CREATE_INDEX_QUERIES:
        conn.execute(query)

    conn.commit()


def _count_table_rows(table_name: str) -> int:
    rows = fetch(COUNT_TABLE_ROWS_QUERY.format(table_name=table_name))
    return int(rows[0]["count"])


def count_database_rows() -> dict[str, int]:
    return {
        name: _count_table_rows(table_name)
        for name, table_name in COUNT_TABLES.items()
    }
