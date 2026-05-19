from app.dataManager.database.calls import fetch as fetch_table
from app.types.responses.model_requests import InteractionRequest, SubmissionList, TaskList
from app.types.responses.model_responses import UserList, FetchInteractionDataResponse
from app.dataManager.fetchData.helpers import _unique, _placeholders, _leaf_to_abstract_type_map, _cancelled_leaf_names, _time_window_condition
from app.dataManager.database.transformations import _task_from_row, _user_from_row, _submission_from_row, _interaction_from_row, _hierarchy_to_response
from app.dataManager.database.constants import TASK_SELECT, USER_SELECT, SUBMISSION_SELECT, INTERACTION_SELECT


def fetch_interaction_data(request: InteractionRequest) -> FetchInteractionDataResponse:
    #fetch all user information based on the user_strings in the InteractionRequest. Fetch from the table "Users"
    
    requested_triplets = request.interactions
    triplet_by_pair = {
        (interaction.user, interaction.task): interaction
        for interaction in requested_triplets
    }
    hierarchy_by_user = {
        interaction.user: interaction.hierarchy
        for interaction in requested_triplets
    }
    abstract_type_by_user = {
        user_name: _leaf_to_abstract_type_map(interaction.hierarchy)
        for (user_name, _), interaction in triplet_by_pair.items()
    }
    cancelled_leaf_names_by_user = {
        user_name: _cancelled_leaf_names(interaction.hierarchy)
        for (user_name, _), interaction in triplet_by_pair.items()
    }
    requested_pairs = _unique([
        (interaction.user, interaction.task)
        for interaction in requested_triplets
    ])
    user_names = _unique([user_name for user_name, _ in requested_pairs])
    task_names = _unique([task_name for _, task_name in requested_pairs])

    user_rows = []
    if user_names:
        user_rows = fetch_table(
            "Users",
            USER_SELECT,
            [f"user_name IN ({_placeholders(user_names)})"],
            "ORDER BY user_name",
            params=tuple(user_names),
        )

    users = UserList(
        users=[
            {
                **_user_from_row(row),
                "hierarchy": _hierarchy_to_response(hierarchy_by_user[row["user_name"]]),
            }
            for row in user_rows
            if row["user_name"] in hierarchy_by_user
        ]
    )

    #fetch all tasks based on the task_strings in the InteractionRequest. . Fetch from the table "Tasks"
    task_rows = []
    if task_names:
        task_rows = fetch_table(
            "Tasks",
            TASK_SELECT,
            [f"task_name IN ({_placeholders(task_names)})"],
            "ORDER BY task_name",
            params=tuple(task_names),
        )

    tasks = TaskList(
        tasks=[
            _task_from_row(row)
            for row in task_rows
        ]
    )

    #fetch start and endtimes of the tasks, store them.
    task_rows_by_name = {
        row["task_name"]: row
        for row in task_rows
    }
    task_id_by_name = {
        row["task_name"]: row["task_id"]
        for row in task_rows
    }
    task_times_by_name = {
        row["task_name"]: (row["task_start_time"], row["task_end_time"])
        for row in task_rows
    }

    #fetch submissions per user/task combination in the InteractionRequest that are within the start/end of the tasks
    submission_rows = []
    submission_rows_by_pair = {}

    for user_name, task_name in requested_pairs:
        if task_name not in task_times_by_name:
            continue

        start_time, end_time = task_times_by_name[task_name]
        time_condition, time_params = _time_window_condition("time", start_time, end_time)
        task_identifier = task_id_by_name.get(task_name)
        task_filter_values = _unique([
            value
            for value in [task_name, task_identifier]
            if value
        ])

        rows = fetch_table(
            "Answers",
            SUBMISSION_SELECT,
            [
                f"task_name IN ({_placeholders(task_filter_values)})",
                "user_name = ?",
                time_condition,
            ],
            "ORDER BY time",
            params=(*task_filter_values, user_name, *time_params),
        )
        pair = (user_name, task_name)
        submission_rows_by_pair[pair] = rows
        submission_rows.extend(rows)

    submissions = SubmissionList(
        submissions=[
            _submission_from_row(row)
            for row in submission_rows
        ]
    )
    

    #fetch interaction rows of user combination in the InteractionRequest within the start/end. group them into tasks (building individual "InteractionTaskUser")
    interaction_task_users = []
    #check answers. set to "not_active" after first correct answer for tasks. if "finished_after_correct_answer" is set to 1 (e.g. true), set all interactions of that task/user combination that come after the first correct submision of this task/user (submissionRow: status==1)
    for user_name, task_name in requested_pairs:
        task_row = task_rows_by_name.get(task_name)

        if task_row is None:
            continue

        start_time, end_time = task_times_by_name[task_name]
        time_condition, time_params = _time_window_condition("time", start_time, end_time)
        interaction_rows = fetch_table(
            "Interactions",
            INTERACTION_SELECT,
            [
                "user_name = ?",
                time_condition,
            ],
            "ORDER BY time",
            params=(user_name, *time_params),
        )

        pair = (user_name, task_name)
        correct_submission_times = [
            row["time"]
            for row in submission_rows_by_pair.get(pair, [])
            if row["status"] == 1
        ]
        first_correct_submission_time = min(correct_submission_times, default=None)
        finishes_after_correct_answer = bool(task_row["finished_after_correct_answer"])
        abstract_type_map = abstract_type_by_user.get(user_name, {})
        cancelled_leaf_names = set(cancelled_leaf_names_by_user.get(user_name, []))

        interaction_task_users.append(
            {
                "user": user_name,
                "task": task_name,
                "interactions": [
                    _interaction_from_row(
                        row,
                        not (
                            finishes_after_correct_answer
                            and first_correct_submission_time is not None
                            and row["time"] > first_correct_submission_time
                        ),
                        abstract_type_map.get(row["type"], row["type"]),
                        row["type"] in cancelled_leaf_names,
                    )
                    for row in interaction_rows
                ],
            }
        )

    return FetchInteractionDataResponse(
        tasks=tasks,
        submissions=submissions,
        interactions=interaction_task_users,
        users=users,
    )
