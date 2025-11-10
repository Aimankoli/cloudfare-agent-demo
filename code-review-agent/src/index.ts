/**
 * AI Code Review Assistant
 * Built with Cloudflare Agents SDK
 *
 * - Run `npm run dev` to start development server
 * - Open http://localhost:8787/ to use the code review assistant
 * - Run `npm run deploy` to publish to production
 */

import { routeAgentRequest } from 'agents';
import { CodeReviewAgent } from './agent';

// Export the Durable Object class
export { CodeReviewAgent };

interface Env {
	CODE_REVIEW_AGENT: DurableObjectNamespace;
	AI: any;
	ENVIRONMENT?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers for API requests
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Route agent requests using the Agents SDK router
		// This handles URLs like /agents/code-review-agent/:userId
		// The router automatically handles WebSocket upgrades and RPC calls
		const agentResponse = await routeAgentRequest(request, env, {
			// Optional: Add CORS support
			onBeforeRequest: async (req) => {
				// Allow requests through
				return undefined;
			}
		});

		if (agentResponse) {
			// Add CORS headers to agent responses
			const headers = new Headers(agentResponse.headers);
			Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
			return new Response(agentResponse.body, {
				status: agentResponse.status,
				statusText: agentResponse.statusText,
				headers
			});
		}

		// Serve static assets (index.html is served from public/ automatically)
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
