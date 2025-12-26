# Hinkal Demo App

A backend server application built with Nx and Express.js, following the same structure as the data-server.

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager

## Getting Started

### Installation

Install dependencies using Yarn:

```bash
yarn install
```

### Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)

### Running the Server

```bash
yarn serve
# or
nx serve server
```

The server will run on `http://localhost:3001`

### API Endpoints

- `GET /api/ping` - Server ping endpoint (returns status: success, message: server is on)

## Project Structure

```
hinkal-demo-app/
├── apps/
│   └── server/          # Express.js backend server
│       └── src/
│           ├── index.ts         # Application entry point
│           ├── constants.ts     # Configuration constants
│           ├── routes/          # Route handlers
│           │   └── ping.ts
│           └── loaders/         # Route loaders
│               └── routeLoader.ts
├── package.json
├── nx.json
└── tsconfig.base.json
```

## Development

### Build

```bash
yarn build
```

### Lint

```bash
yarn lint
```

## License

MIT
