import axios from "axios";
import type {
    FetchInteractionDataResponse,
    FetchTasksAndAnswers,
    FetchUsersAndTasks,
    InteractionRequest,
} from "../types/dataTypes";

const selectAllFetchedInteractions = (
    data: FetchInteractionDataResponse,
): FetchInteractionDataResponse => ({
    ...data,
    submissions: {
        ...data.submissions,
        submissions: data.submissions.submissions.map((submission) => ({
            ...submission,
            selected: true,
        })),
    },
    interactions: data.interactions.map((interactionGroup) => ({
        ...interactionGroup,
        interactions: interactionGroup.interactions.map((interaction) => ({
            ...interaction,
            selected: true,
        })),
    })),
});

export const fetchUsersAndTasks = async (): Promise<FetchUsersAndTasks> => {
    const response = await fetch("/api/data/get-user-and-tasks", {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch users and tasks: ${response.status}`);
    }

    return await response.json() as FetchUsersAndTasks;
};

export const fetchTasksAndAnswers = async (
    signal?: AbortSignal,
): Promise<FetchTasksAndAnswers> => {
    const response = await fetch("/api/data/get-tasks-and-answers", {
        method: "GET",
        signal,
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tasks and answers: ${response.status}`);
    }

    return await response.json() as FetchTasksAndAnswers;
};

export const fetchInteractions = async (
    request: InteractionRequest,
): Promise<FetchInteractionDataResponse> => {
    const response = await fetch("/api/data/get-interactions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch interactions: ${response.status}`);
    }

    return selectAllFetchedInteractions(await response.json() as FetchInteractionDataResponse);
};

/**
 * Extracts a readable message from an unknown error object.
 * @param error - The error object to process.
 * @returns A string describing the error.
 */
export const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message || error.message || 'An Axios error occurred.';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred.';
};
