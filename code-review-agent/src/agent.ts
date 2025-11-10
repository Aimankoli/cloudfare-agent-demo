import { Agent, callable } from 'agents';

// Define the state structure for our code review agent
interface CodeReviewState {
  userId: string;
  preferences: {
    language: string;
    styleGuide: string;
    strictness: 'lenient' | 'moderate' | 'strict';
    focusAreas: string[];
  };
  reviewHistory: Array<{
    id: string;
    code: string;
    review: string;
    timestamp: number;
    accepted: boolean;
  }>;
  patterns: {
    commonIssues: string[];
    ignoredRules: string[];
    customRules: string[];
  };
}

// Define the environment type
interface Env {
  CODE_REVIEW_AGENT: DurableObjectNamespace;
  AI: any;
  ENVIRONMENT?: string;
}

export class CodeReviewAgent extends Agent<Env, CodeReviewState> {
  // Set initial state for new agent instances
  initialState: CodeReviewState = {
    userId: '',
    preferences: {
      language: 'python',
      styleGuide: 'PEP8',
      strictness: 'moderate',
      focusAreas: ['readability', 'performance', 'security']
    },
    reviewHistory: [],
    patterns: {
      commonIssues: [],
      ignoredRules: [],
      customRules: []
    }
  };

  async onStart() {
    console.log('Code Review Agent started');

    // Initialize SQL tables for advanced pattern storage
    await this.sql`
      CREATE TABLE IF NOT EXISTS review_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_feedback TEXT
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS code_snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        language TEXT,
        review TEXT,
        issues_found INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        helpful BOOLEAN
      )
    `;
  }

  @callable({ description: "Review code and provide feedback" })
  async reviewCode(code: string, language?: string) {
    const userLanguage = language || this.state.preferences.language;

    // Get user's patterns from history
    const recentPatterns = await this.sql`
      SELECT pattern, user_feedback
      FROM review_patterns
      WHERE pattern_type = 'common_issue'
      ORDER BY frequency DESC
      LIMIT 5
    `;

    // Build personalized prompt based on user preferences
    const prompt = this.buildReviewPrompt(code, userLanguage, recentPatterns);

    try {
      // Call Workers AI for code review
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        stream: false,
        max_tokens: 1000
      });

      const review = response.response;

      // Store the review in history
      await this.storeReview(code, review, userLanguage);

      // Extract and learn patterns
      await this.learnFromReview(review);

      return {
        success: true,
        review,
        language: userLanguage,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Review error:', error);
      return {
        success: false,
        error: 'Failed to generate review',
        timestamp: Date.now()
      };
    }
  }

  private buildReviewPrompt(code: string, language: string, patterns: any[]): string {
    const { preferences } = this.state;

    let prompt = `You are an expert ${language} code reviewer.
Review the following code with ${preferences.strictness} strictness.
Focus on: ${preferences.focusAreas.join(', ')}.
Style guide: ${preferences.styleGuide}.

${patterns.length > 0 ? `\nCommon issues to check: ${patterns.map(p => p.pattern).join(', ')}` : ''}

Code to review:
\`\`\`${language}
${code}
\`\`\`

Provide a structured review with:
1. Issues found (if any)
2. Suggestions for improvement
3. Good practices observed
4. Security concerns (if any)

Be constructive and educational.`;

    return prompt;
  }

  async storeReview(code: string, review: string, language: string) {
    // Store in SQL for advanced queries
    await this.sql`
      INSERT INTO code_snippets (code, language, review, issues_found, timestamp)
      VALUES (${code}, ${language}, ${review}, ${this.countIssues(review)}, ${Date.now()})
    `;

    // Update state history (keep last 10)
    const history = this.state.reviewHistory || [];
    history.unshift({
      id: crypto.randomUUID(),
      code,
      review,
      timestamp: Date.now(),
      accepted: false
    });

    if (history.length > 10) {
      history.pop();
    }

    await this.setState({
      ...this.state,
      reviewHistory: history
    });
  }

  async learnFromReview(review: string) {
    // Extract patterns from the review using simple pattern matching
    const issuePatterns = review.match(/Issue:([^.]+)/g) || [];

    for (const pattern of issuePatterns) {
      await this.sql`
        INSERT INTO review_patterns (pattern_type, pattern)
        VALUES ('detected_issue', ${pattern})
        ON CONFLICT(pattern) DO UPDATE SET
        frequency = frequency + 1,
        last_seen = CURRENT_TIMESTAMP
      `;
    }
  }

  @callable({ description: "Update review preferences" })
  async updatePreferences(preferences: Partial<CodeReviewState['preferences']>) {
    await this.setState({
      ...this.state,
      preferences: {
        ...this.state.preferences,
        ...preferences
      }
    });

    return { success: true, preferences: this.state.preferences };
  }

  @callable({ description: "Provide feedback on a review" })
  async provideFeedback(reviewId: string, helpful: boolean, comments?: string) {
    // Find the review in history
    const reviewIndex = this.state.reviewHistory.findIndex(r => r.id === reviewId);

    if (reviewIndex !== -1) {
      const history = [...this.state.reviewHistory];
      history[reviewIndex].accepted = helpful;

      await this.setState({
        ...this.state,
        reviewHistory: history
      });

      // Update patterns based on feedback
      if (!helpful && comments) {
        await this.sql`
          INSERT INTO review_patterns (pattern_type, pattern, user_feedback)
          VALUES ('user_preference', ${comments}, 'negative')
        `;
      }
    }

    return { success: true };
  }

  @callable({ description: "Get review statistics" })
  async getStats() {
    const totalReviewsResult = this.sql`
      SELECT COUNT(*) as count FROM code_snippets
    `;
    const totalReviews = (totalReviewsResult[0] as any)?.count || 0;

    const commonIssues = this.sql`
      SELECT pattern, frequency
      FROM review_patterns
      WHERE pattern_type = 'detected_issue'
      ORDER BY frequency DESC
      LIMIT 5
    `;

    return {
      totalReviews,
      commonIssues,
      preferences: this.state.preferences,
      recentReviews: this.state.reviewHistory.length
    };
  }

  private countIssues(review: string): number {
    const issueMatches = review.match(/issue|problem|error|warning|concern/gi);
    return issueMatches ? issueMatches.length : 0;
  }

  // Handle WebSocket connection
  async onConnect(connection: any) {
    console.log('WebSocket connection established');
    // Send initial stats when connected
    const stats = await this.getStats();
    connection.send(JSON.stringify({ type: 'stats', ...stats }));
  }

  // Handle WebSocket messages
  async onMessage(connection: any, message: string) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'review':
          const result = await this.reviewCode(data.code, data.language);
          connection.send(JSON.stringify({ type: 'review-result', ...result }));
          break;

        case 'update-preferences':
          const prefs = await this.updatePreferences(data.preferences);
          connection.send(JSON.stringify({ type: 'preferences-updated', ...prefs }));
          break;

        case 'feedback':
          const feedback = await this.provideFeedback(data.reviewId, data.helpful, data.comments);
          connection.send(JSON.stringify({ type: 'feedback-received', ...feedback }));
          break;

        case 'get-stats':
          const stats = await this.getStats();
          connection.send(JSON.stringify({ type: 'stats', ...stats }));
          break;

        default:
          connection.send(JSON.stringify({ type: 'error', message: 'Unknown command' }));
      }
    } catch (error: any) {
      connection.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message',
        error: error.message
      }));
    }
  }

  // Handle WebSocket close
  async onClose(connection: any, code: number, reason: string) {
    console.log(`WebSocket connection closed: ${code} - ${reason}`);
  }
}
