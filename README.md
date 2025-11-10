# AI Code Review Assistant

A stateful, intelligent code review assistant powered by Cloudflare Agents that learns from your coding patterns and provides personalized feedback.

## Motivation

This application reviews code, dynamically learns from your coding habits, and gives live suggestions. As a student, we tend to rely heavily on AI tools to complete projects and assignments without truly understanding what's happening under the hood. I wanted to create the perfect balance between coding assignments myself while having an AI mentor by my side to review my code and guide me through the project—rather than completing it for me.

This tool acts as a **learning companion** rather than a code generator, helping developers improve their skills through constructive feedback.

## Features

### Core Capabilities
- **AI-Powered Code Review**: Leverages Cloudflare Workers AI (Llama 3.1) to provide intelligent code analysis
- **Multi-Language Support**: Reviews code in Python, JavaScript, TypeScript, Java, C++, Go, and Rust
- **Persistent Learning**: Uses Durable Objects to maintain user-specific state and learn from review history
- **Real-Time Communication**: WebSocket support for instant, bidirectional communication
- **Personalized Feedback**: Adapts to user preferences including strictness level, style guides, and focus areas

### Intelligent Features
- **Pattern Recognition**: Identifies common issues across your code submissions
- **Custom Preferences**: Configurable language, style guide (PEP8, Airbnb, Google), and review strictness
- **Review History**: Stores past reviews with SQLite for pattern analysis and learning
- **Feedback Loop**: Learns from user feedback to improve future reviews
- **Session Statistics**: Tracks review metrics and displays common issues

## Architecture

### Stack
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **State Management**: Durable Objects with SQLite
- **AI Model**: Workers AI (@cf/meta/llama-3.1-8b-instruct)
- **Real-time Communication**: WebSockets
- **Frontend**: Vanilla JavaScript with responsive CSS

### Key Components

#### 1. Durable Objects (Stateful Agent)
Each user gets a persistent `CodeReviewAgent` instance that maintains:
- User preferences and settings
- Review history (last 10 reviews in memory)
- Learned patterns and common issues (in SQLite)
- Custom rules and ignored patterns

#### 2. SQLite Storage
Two main tables for advanced pattern tracking:
```sql
review_patterns: Stores frequently occurring code patterns and issues
code_snippets: Maintains complete review history with metadata
```

#### 3. Workers AI Integration
- Utilizes Llama 3.1 8B model for code analysis
- Dynamic prompt construction based on user preferences
- Structured output format for consistent reviews

#### 4. WebSocket Handler
Supports multiple message types:
- `review`: Request code review
- `update-preferences`: Modify review settings
- `feedback`: Provide feedback on review quality
- `get-stats`: Retrieve session statistics

## Setup & Installation

### Prerequisites
- Node.js v16 or higher
- npm or yarn
- Cloudflare account

### Local Development

1. **Clone the repository**
```bash
cd code-review-agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Authenticate with Cloudflare**
```bash
wrangler login
```

4. **Start development server**
```bash
npm run dev
```

5. **Open browser**
Navigate to `http://localhost:8787`

### Configuration

The `wrangler.jsonc` file includes:
- AI binding for Workers AI access
- Durable Objects binding for state management
- SQLite migrations for database tables

## Deployment

### Deploy to Cloudflare Workers
```bash
npm run deploy
```

Your application will be deployed to:
```
https://code-review-agent.[your-subdomain].workers.dev
```

### Production Features
- Global edge deployment for low latency
- Auto-scaling based on traffic
- Built-in DDoS protection
- Zero cold starts with Durable Objects

## Usage

### Basic Code Review
1. Paste your code into the left panel
2. Select your programming language
3. Click "Review Code"
4. View AI-generated review in the right panel

### Customizing Preferences
1. Choose your preferred language
2. Set strictness level (Lenient/Moderate/Strict)
3. Select style guide
4. Click "Update Preferences"

### WebSocket Mode
Click "Connect Real-time" for:
- Instant reviews without page refresh
- Live statistics updates
- Persistent connection for multiple reviews

## What Makes This Unique

### Compared to Generic AI Code Review Tools

1. **Stateful Learning**: Unlike stateless AI tools, this assistant remembers your coding patterns, common mistakes, and preferences across sessions.

2. **Edge Computing**: Deployed on Cloudflare's global network, providing <50ms latency for users worldwide.

3. **True Persistence**: Durable Objects ensure your agent state survives between requests, enabling genuine learning over time.

4. **Multi-Tenant Architecture**: Each user gets their own isolated agent instance with independent state and learning.

5. **Embedded Database**: SQLite integration allows complex pattern queries and historical analysis without external database dependencies.

6. **Real-Time Capable**: WebSocket support enables instant feedback and live collaboration scenarios.

## Technical Highlights

### Cloudflare Platform Features Utilized
- **Workers AI**: On-demand LLM inference without managing infrastructure
- **Durable Objects**: Strongly consistent, stateful coordination
- **SQLite**: Embedded database for complex queries
- **WebSockets**: Real-time bidirectional communication
- **Edge Runtime**: V8 isolates for instant cold starts

### Code Quality
- TypeScript for type safety
- Structured error handling
- Graceful degradation for WebSocket failures
- Responsive UI with loading states
- Clean separation of concerns

## Future Enhancements

- [ ] GitHub integration for PR reviews
- [ ] Team collaboration features
- [ ] Export review history as PDF/Markdown
- [ ] IDE plugins (VS Code, IntelliJ)
- [ ] Code comparison and diff visualization
- [ ] Custom rule creation UI
- [ ] Multi-file project analysis
- [ ] Integration with CI/CD pipelines

## Project Structure

```
code-review-agent/
├── src/
│   ├── index.ts          # Main worker entry point
│   ├── agent.ts          # CodeReviewAgent Durable Object
│   └── worker-configuration.d.ts
├── public/
│   └── index.html        # Frontend UI
├── wrangler.jsonc        # Cloudflare Workers configuration
├── package.json
└── tsconfig.json
```

## Performance Metrics

- **Cold Start**: <5ms (V8 isolates)
- **Review Latency**: ~800ms (including AI inference)
- **WebSocket Overhead**: <1ms
- **State Persistence**: Instant (Durable Objects)
- **Global Availability**: 275+ cities

## License

MIT License - Feel free to use this project as a learning resource or foundation for your own code review tools.

## Acknowledgments

Built with Cloudflare Workers, Durable Objects, and Workers AI. Special thanks to the Cloudflare developer platform team for creating such powerful edge computing primitives.

---

**Built by**: A student developer passionate about AI-assisted learning
**Platform**: Cloudflare Workers + Agents
**Model**: Llama 3.1 8B Instruct