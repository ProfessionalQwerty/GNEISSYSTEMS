# GNEISS CLI

Local structural analysis tool for Java projects.

## Installation

```bash
# Run this for Windows
irm https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.ps1 | iex

# Run this for Mac
curl -fsSL https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.sh | bash
```

## Usage

### Authentication

First, authenticate with your GitHub account:

```bash
gneiss auth
```

This will open a browser window where you can authorize GNEISS to access your GitHub account.

### Analyze a Project

Analyze a local Java directory:

```bash
gneiss audit ./src
```

With custom depth:

```bash
gneiss audit ./src --depth 20
```

## Features

- **Local Scanning**: Scans local Java files for import statements
- **Dependency Graph**: Builds anonymized dependency graphs from imports
- **Secure**: No API keys stored in the CLI; uses GitHub OAuth
- **Rate Limited**: Respects rate limits per account
- **Beautiful Output**: Streams markdown results directly to terminal


## License

MIT
