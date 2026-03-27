import { describe, it, expect } from 'bun:test';
import {
  hasLoginWall,
} from '../../src/utils.ts';

/**
 * HTML FIXTURES FOR AUTH CHECKS
 * These fixtures represent various authentication-related scenarios
 * commonly encountered when accessing X/Twitter content
 */

// Login wall scenarios
const loginWallFixtures = {
  simpleLoginPrompt: `
    <html>
      <body>
        <div>
          <p>Log in to X</p>
          <button>Sign in</button>
        </div>
      </body>
    </html>
  `,

  loginToFollowAccount: `
    <html>
      <body>
        <div class="auth-prompt">
          <h2>Log in to follow this account</h2>
          <p>You need to log in to follow this account and see their tweets</p>
          <button>Sign in</button>
        </div>
      </body>
    </html>
  `,

  signUpPrompt: `
    <html>
      <body>
        <div class="auth-modal">
          <h1>Create an account or log in</h1>
          <button>Sign up</button>
          <button>Log in</button>
        </div>
      </body>
    </html>
  `,

  joinConversation: `
    <html>
      <body>
        <div class="restricted-content">
          <p>Join the conversation. Sign in or create an account to reply, like, or share this X.</p>
        </div>
      </body>
    </html>
  `,

  signInToView: `
    <html>
      <body>
        <div class="gated-content">
          <p>Sign in to view this tweet</p>
          <a href="/login">Sign in here</a>
        </div>
      </body>
    </html>
  `,

  multipleIndicators: `
    <html>
      <body>
        <header>
          <button>Log in</button>
          <button>Sign up</button>
        </header>
        <main>
          <p>You need to Sign in to see this content</p>
          <p>Join the conversation and share your thoughts</p>
        </main>
      </body>
    </html>
  `,

  loginWallWithContent: `
    <html>
      <body>
        <div class="tweet-container">
          <div class="tweet">
            <p>This is a tweet</p>
            <video src="https://video.twimg.com/video.mp4"></video>
          </div>
          <div class="auth-overlay">
            <p>Log in to see this tweet</p>
            <button>Sign in</button>
          </div>
        </div>
      </body>
    </html>
  `,

  caseInsensitiveLoginWall: `
    <html>
      <body>
        <div>
          <p>LOG IN to continue</p>
          <button>Sign in now</button>
        </div>
      </body>
    </html>
  `,
};

// Edge cases and false positives to avoid
const nonAuthFixtures = {
  publicTweet: `
    <html>
      <body>
        <div class="tweet">
          <p>This is a public tweet anyone can see</p>
          <video src="https://video.twimg.com/tweet_video.mp4"></video>
        </div>
      </body>
    </html>
  `,

  articleWithLoginText: `
    <html>
      <body>
        <article>
          <h1>How to Access X - A Guide</h1>
          <p>This article discusses how to log in to X using OAuth.</p>
          <p>To sign up for X, visit the website.</p>
        </article>
      </body>
    </html>
  `,

  helpDocumentation: `
    <html>
      <body>
        <div class="help-article">
          <h1>Authentication Help</h1>
          <p>Click the button in the top right to log in to your account.</p>
          <p>If you don't have an account yet, you can sign up here.</p>
        </div>
      </body>
    </html>
  `,

  emptyContent: `
    <html>
      <body>
      </body>
    </html>
  `,
};

// Tests for hasLoginWall()
describe('hasLoginWall Detection', () => {
  describe('Basic Login Wall Detection', () => {
    it('should detect simple login prompts', () => {
      expect(hasLoginWall(loginWallFixtures.simpleLoginPrompt)).toBe(true);
    });

    it('should detect "log in to follow" prompts', () => {
      expect(hasLoginWall(loginWallFixtures.loginToFollowAccount)).toBe(true);
    });

    it('should detect sign up prompts', () => {
      expect(hasLoginWall(loginWallFixtures.signUpPrompt)).toBe(true);
    });

    it('should detect "join the conversation" prompts', () => {
      expect(hasLoginWall(loginWallFixtures.joinConversation)).toBe(true);
    });

    it('should detect "sign in to view" prompts', () => {
      expect(hasLoginWall(loginWallFixtures.signInToView)).toBe(true);
    });

    it('should detect multiple login indicators', () => {
      expect(hasLoginWall(loginWallFixtures.multipleIndicators)).toBe(true);
    });

    it('should detect login wall even with video content present', () => {
      expect(hasLoginWall(loginWallFixtures.loginWallWithContent)).toBe(true);
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect login walls regardless of case', () => {
      expect(hasLoginWall(loginWallFixtures.caseInsensitiveLoginWall)).toBe(true);
    });
  });

  describe('Avoiding False Positives', () => {
    it('should not flag public tweets with video as login walls', () => {
      expect(hasLoginWall(nonAuthFixtures.publicTweet)).toBe(false);
    });

    it('should not flag instructional text about signing up as login walls', () => {
      expect(hasLoginWall(nonAuthFixtures.articleWithLoginText)).toBe(false);
    });

    it('should not flag help documentation as login walls', () => {
      expect(hasLoginWall(nonAuthFixtures.helpDocumentation)).toBe(false);
    });

    it('should not flag empty content as login walls', () => {
      expect(hasLoginWall(nonAuthFixtures.emptyContent)).toBe(false);
    });
  });
});
