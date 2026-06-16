# GNEISS CLI Setup Guide

## Quick Start

### For Windows Users:
```bash
# Run the installation script
install.bat
```

### For Mac/Linux Users:
```bash
# Make the script executable and run it
chmod +x install.sh
./install.sh
```

### Manual Installation:
```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Install globally (optional)
npm link
```

## Configuration

The CLI uses the following environment variables:

- `GNEISS_API_URL`: Backend API URL (default: https://gneiss-platform.vercel.app)

You can set this in your environment or create a `.env` file in the CLI directory:

```bash
GNEISS_API_URL=https://your-backend-url.com
```

## Usage

### 1. Authenticate with GitHub
```bash
gneiss auth
```

This will:
1. Generate a GitHub OAuth URL
2. Open your browser to authenticate
3. Provide you with an authorization code
4. Exchange the code for an access token
5. Store the token securely in `~/.gneiss/auth.json`

### 2. Analyze a Java Project
```bash
gneiss audit ./path/to/your/java/project
```

With custom depth:
```bash
gneiss audit ./path/to/your/java/project --depth 20
```

## Troubleshooting

### "Cannot find module" errors
Run `npm install` to install all dependencies.

### "Not authenticated" error
Run `gneiss auth` to authenticate with GitHub.

### "Rate limit exceeded" error
Free tier users are limited to 3 scans per day. Upgrade to Pro for unlimited scans.

### Connection errors
Check your internet connection and ensure the backend API is accessible.

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Security

- The CLI stores authentication tokens in `~/.gneiss/auth.json` with restricted permissions (0o600)
- No API keys or secrets are hardcoded in the CLI
- All sensitive data is handled through secure OAuth flows
- Rate limiting is enforced on the backend per user account

## License

MIT
