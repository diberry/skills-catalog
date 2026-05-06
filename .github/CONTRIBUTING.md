# Contributing to Skills Catalog

Thank you for your interest in contributing to the Skills Catalog project!

## All Changes Require a Pull Request

We maintain code quality and traceability by requiring all changes to go through a pull request (PR) process. This means:

- **No direct commits to main** — even administrators cannot push directly to the main branch
- **Every change** must be reviewed before merging
- **Branch protection** is enforced to protect the integrity of the main branch

## Branch Naming Conventions

Please use one of the following prefixes when creating your feature branches:

- **eat/** — New features or enhancements (e.g., eat/add-new-skill-type)
- **ix/** — Bug fixes (e.g., ix/resolve-build-issue)
- **docs/** — Documentation updates (e.g., docs/update-readme)

Example: git checkout -b feat/my-new-skill

## Tests Must Pass Before Merge

All pull requests must pass our automated tests before they can be merged:

- Run the test suite locally before pushing your changes
- Ensure all CI/CD checks pass in the PR
- Address any test failures or linting issues
- Request reviews from maintainers when ready

## Process

1. Create a new branch from main using the naming convention above
2. Make your changes and commit them
3. Push your branch to the repository
4. Open a pull request with a clear description of your changes
5. Address any review comments
6. Once approved and tests pass, a maintainer will merge your PR

## Questions?

If you have questions about the contribution process, please open an issue or reach out to the project maintainers.
