# RIVALS Frontend

The RIVALS frontend is a React, TypeScript, and Vite application for loading retrieval log data and exploring it through interactive visualizations. It uses Ant Design for UI controls, FlexLayout for dockable panels, and D3 for visualization rendering.

## Application Overview

The main application shell is a full-height FlexLayout workspace:

- The header contains buttons for opening visualization tabs.
- The left border panel contains the data loader.
- The right border panel contains task and answer views.
- The central workspace starts with a summary view and can contain additional visualization tabs.

Current visualization components include:

- `Summary`: Combined overview of loaded interaction data.
- `Count Barchart`: Action frequency analysis.
- `Duration Bar Chart`: Estimated task-time distribution by action.
- `Search Lines`: Timeline-style interaction visualization.
- `Strategy Analysis`: Analysis views for classifier, motif, and efficiency workflows.

## Data Loading

The frontend accepts JSON files through the data loader and sends them to the backend. Supported uploads are:

- Task metadata.
- Task answers/submissions.
- System-specific interaction logs.
- Official DRES JSON exports through **Load DRES Logs**.

DRES imports are inspected before loading. The UI then asks for dataset names per DRES task group and video roots per dataset before submitting the import request.

Detailed input formats are documented in the root [README.md](../README.md#input-formats).

## API Communication

Frontend API helpers live in `vite-app/src/api-handler/Requests.ts`. They use relative `/api` URLs so the same frontend code works in both local development and deployment:

- In local Docker development, Vite proxies `/api` to the backend service.
- In deployed builds, the Nginx configuration can proxy `/api` to the configured backend host and port.

## Project Structure

- `vite-app/`: Main React/Vite application.
- `vite-app/src/App.tsx`: Application shell and providers.
- `vite-app/src/api-handler/`: Backend API request helpers.
- `vite-app/src/types/`: Shared frontend TypeScript data types.
- `vite-app/src/ui/ui-layout/`: Header and outer UI layout.
- `vite-app/src/ui/flex-layout/`: FlexLayout workspace, layout context, and widget factory.
- `vite-app/src/ui/flex-layout/components/sidebars/`: Data loading and task/answer side panels.
- `vite-app/src/ui/flex-layout/components/visualizations/`: Visualization components.
- `dev.Dockerfile`: Development image used by Docker Compose.
- `nginx-deployment/`: Nginx template and entrypoint for serving built frontend assets with an API proxy.

## Docker Notes

The development Docker image installs dependencies inside the container and Docker Compose mounts `vite-app/` as the working source directory. `node_modules` is kept in a named Docker volume so host-specific dependencies do not overwrite container dependencies.

For IDE support on the host, install dependencies locally inside `frontend/vite-app`. Keep lockfiles up to date when changing dependencies.

## Related Documentation

- [Root project README](../README.md)
- [Backend README](../backend/README.md)
