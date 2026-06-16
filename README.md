# GNEISS CLI

Local structural analysis tool for Java projects.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gneiss-cli.git
cd gneiss-cli

# Install dependencies
npm install

# Build the CLI
npm run build

# Install globally (optional)
npm link
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

## Configuration

The CLI uses the following environment variables:

- `GNEISS_API_URL`: Backend API URL (default: https://gneiss-platform.vercel.app)

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## License

MIT
