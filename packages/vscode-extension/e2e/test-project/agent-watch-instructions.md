# AgentWatch Instructions

> Define project-specific validation rules below.
> Each rule is a list item. Optionally prefix with a severity tag: [high], [medium], or [low].
> Rules without a tag default to [medium].

## Security
- [high] Flag any changes to authentication or authorization logic
- [high] Detect hardcoded secrets, API keys, or credentials

## Data Integrity
- [high] Flag changes to database schema or migration files
- [medium] Watch for changes to data validation logic

## API Contracts
- [medium] Flag changes to public API endpoints or response shapes
- [medium] Flag removed or changed error handling in API routes

## Documentation
- [low] Note changes to README or documentation files

## Custom Rules
- [medium] Flag any removed error handlers
- [low] Note changes to configuration files

## Debuf
- [high] Unused constants or variables