# DairyVision AI Git Workflow

## 1. Branch Strategy

Use a simple and predictable branch model:

- `main`: production-ready code
- `develop`: integration branch for ongoing work
- `feature/<short-name>`: feature work
- `fix/<short-name>`: bug fixes
- `chore/<short-name>`: tooling and documentation updates

## 2. Commit Guidelines

- Write clear, descriptive commit messages.
- Prefer small, focused commits over large mixed changes.
- Include the area of change in the message when useful.

Example:

- `feat(auth): add login and protected route flow`
- `docs: add architecture and API planning documents`
- `fix(db): correct farm relationship constraints`

## 3. Pull Request Process

1. Create a feature branch from `develop`.
2. Implement the work in small increments.
3. Run tests and relevant validation checks.
4. Open a pull request with a clear summary and testing notes.
5. Request review from at least one other engineer.
6. Merge only after feedback is addressed.

## 4. Review Expectations

- Review for correctness, readability, and architecture fit.
- Check for security issues and missing test coverage.
- Ensure documentation is updated when behavior or contracts change.

## 5. Release Flow

- Merge approved work into `develop`.
- Run regression checks and staging validation.
- Merge `develop` into `main` for release.
- Tag releases with semantic versioning when appropriate.

## 6. Branch Hygiene

- Delete merged feature branches promptly.
- Keep the branch history clean and reviewable.
- Avoid direct commits to `main` unless justified by emergency hotfixes.
