from app.dataManager.database.calls import fetch as fetch_table
from app.dataManager.database.constants import TASK_SELECT, USER_SELECT
from app.dataManager.database.transformations import _task_from_row, _user_from_row
from app.types.responses.model_requests import TaskList
from app.types.responses.model_responses import FetchUsersAndTasks, UserList


def fetch_users_and_tasks() -> FetchUsersAndTasks:
    task_rows = fetch_table(
        "Tasks",
        TASK_SELECT,
        [],
        "ORDER BY task_name",
    )

    user_rows = fetch_table(
        "Users",
        USER_SELECT,
        [],
        "ORDER BY user_name",
    )

    tasks = TaskList(
        tasks=[
            _task_from_row(row)
            for row in task_rows
        ]
    )

    users = UserList(
        users=[
            _user_from_row(row)
            for row in user_rows
        ]
    )
    return FetchUsersAndTasks(tasks=tasks, users=users)
