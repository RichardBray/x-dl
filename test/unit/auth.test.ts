import { describe, it, expect } from 'bun:test';
import {
  hasLoginWall,
  isPrivateTweet,
  hasCookie,
  findAuthCookies,
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

// Protected/Private tweet scenarios
const protectedTweetFixtures = {
  protectedAccount: `
    <html>
      <body>
        <div class="error-message">
          <p>This tweet is from an account that is protected</p>
        </div>
      </body>
    </html>
  `,

  protectedTweets: `
    <html>
      <body>
        <div class="restricted">
          <p>These tweets are protected</p>
          <p>Only followers can see this content</p>
        </div>
      </body>
    </html>
  `,

  notAuthorized: `
    <html>
      <body>
        <div class="error">
          <h2>You are not authorized to view this tweet</h2>
        </div>
      </body>
    </html>
  `,

  tweetProtected: `
    <html>
      <body>
        <div class="tweet-error">
          <p>This tweet is protected</p>
        </div>
      </body>
    </html>
  `,

  onlyFollowersCanSee: `
    <html>
      <body>
        <div class="access-restricted">
          <p>Only followers can see posts from this account</p>
        </div>
      </body>
    </html>
  `,

  caseInsensitiveProtected: `
    <html>
      <body>
        <div>
          <p>PROTECTED TWEETS</p>
          <p>YOU ARE NOT AUTHORIZED TO VIEW THIS CONTENT</p>
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

  publicTweetWithComments: `
    <html>
      <body>
        <div class="tweet">
          <p>Check out this video! To sign up for alerts, click here.</p>
          <video src="https://video.twimg.com/video.mp4"></video>
          <p>Log in to comment on this tweet</p>
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

  whitespaceSensitive: `
    <html>
      <body>
        <div>Content here with no auth keywords</div>
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

// Tests for isPrivateTweet()
describe('Private Tweet Detection', () => {
  describe('Basic Protected Tweet Detection', () => {
    it('should detect protected accounts', () => {
      expect(isPrivateTweet(protectedTweetFixtures.protectedAccount)).toBe(true);
    });

    it('should detect "these tweets are protected" messages', () => {
      expect(isPrivateTweet(protectedTweetFixtures.protectedTweets)).toBe(true);
    });

    it('should detect "not authorized" messages', () => {
      expect(isPrivateTweet(protectedTweetFixtures.notAuthorized)).toBe(true);
    });

    it('should detect "this tweet is protected" messages', () => {
      expect(isPrivateTweet(protectedTweetFixtures.tweetProtected)).toBe(true);
    });

    it('should detect "only followers can see" messages', () => {
      expect(isPrivateTweet(protectedTweetFixtures.onlyFollowersCanSee)).toBe(true);
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect protected tweets regardless of case', () => {
      expect(isPrivateTweet(protectedTweetFixtures.caseInsensitiveProtected)).toBe(true);
    });
  });

  describe('Avoiding False Positives', () => {
    it('should not flag public tweets as private', () => {
      expect(isPrivateTweet(nonAuthFixtures.publicTweet)).toBe(false);
    });

    it('should not flag public tweets even with "sign up" text', () => {
      expect(isPrivateTweet(nonAuthFixtures.publicTweetWithComments)).toBe(false);
    });

    it('should not flag help articles as private tweets', () => {
      expect(isPrivateTweet(nonAuthFixtures.helpDocumentation)).toBe(false);
    });

    it('should not flag empty content as private', () => {
      expect(isPrivateTweet(nonAuthFixtures.emptyContent)).toBe(false);
    });
  });

  describe('Interaction with Login Walls', () => {
    it('should distinguish protected tweets from login walls', () => {
      // Public tweet with login prompt should be detected as login wall, not private tweet
      expect(isPrivateTweet(nonAuthFixtures.publicTweetWithComments)).toBe(false);
    });
  });
});

// Tests for auth cookie logic
describe('Auth Cookie Functions', () => {
  describe('hasCookie', () => {
    it('should find a cookie by name', () => {
      const cookies = [
        { name: 'auth_token', value: 'token123' },
        { name: 'other_cookie', value: 'value456' },
      ];
      expect(hasCookie(cookies, 'auth_token')).toBe(true);
    });

    it('should return false when cookie is not present', () => {
      const cookies = [
        { name: 'session_id', value: 'sess123' },
        { name: 'other_cookie', value: 'value456' },
      ];
      expect(hasCookie(cookies, 'auth_token')).toBe(false);
    });

    it('should handle empty cookie array', () => {
      expect(hasCookie([], 'auth_token')).toBe(false);
    });

    it('should be case sensitive for cookie names', () => {
      const cookies = [
        { name: 'Auth_Token', value: 'token123' },
      ];
      expect(hasCookie(cookies, 'auth_token')).toBe(false);
      expect(hasCookie(cookies, 'Auth_Token')).toBe(true);
    });
  });

  describe('findAuthCookies', () => {
    it('should find all auth-related cookies', () => {
      const cookies = [
        { name: 'auth_token', value: 'token123' },
        { name: 'auth_multi_select', value: 'select456' },
        { name: 'personalization_id', value: 'pers789' },
        { name: 'ct0', value: 'csrf_token' },
        { name: 'other_cookie', value: 'other' },
      ];
      const result = findAuthCookies(cookies);
      expect(result.sort()).toEqual(['auth_multi_select', 'auth_token', 'ct0', 'personalization_id'].sort());
    });

    it('should return empty array when no auth cookies present', () => {
      const cookies = [
        { name: 'session_id', value: 'sess123' },
        { name: 'other_cookie', value: 'value456' },
      ];
      expect(findAuthCookies(cookies)).toEqual([]);
    });

    it('should handle empty cookie array', () => {
      expect(findAuthCookies([])).toEqual([]);
    });

    it('should find auth_token specifically', () => {
      const cookies = [
        { name: 'auth_token', value: 'token123' },
      ];
      expect(findAuthCookies(cookies)).toContain('auth_token');
    });

    it('should find auth_multi_select cookie', () => {
      const cookies = [
        { name: 'auth_multi_select', value: 'select456' },
      ];
      expect(findAuthCookies(cookies)).toContain('auth_multi_select');
    });

    it('should find personalization_id cookie', () => {
      const cookies = [
        { name: 'personalization_id', value: 'pers789' },
      ];
      expect(findAuthCookies(cookies)).toContain('personalization_id');
    });

    it('should find ct0 (CSRF) cookie', () => {
      const cookies = [
        { name: 'ct0', value: 'csrf_token' },
      ];
      expect(findAuthCookies(cookies)).toContain('ct0');
    });

    it('should return only the cookie names, not values', () => {
      const cookies = [
        { name: 'auth_token', value: 'token123' },
        { name: 'auth_multi_select', value: 'select456' },
      ];
      const result = findAuthCookies(cookies);
      result.forEach(name => {
        expect(typeof name).toBe('string');
        expect(name).not.toContain('token123');
        expect(name).not.toContain('select456');
      });
    });

    it('should handle cookies with extra properties', () => {
      const cookies = [
        { name: 'auth_token', value: 'token123', domain: '.x.com', path: '/' },
        { name: 'other', value: 'other_value', domain: '.x.com' },
      ];
      const result = findAuthCookies(cookies);
      expect(result).toContain('auth_token');
      expect(result).not.toContain('other');
    });
  });
});

// Integration-style tests combining auth detection functions
describe('Auth Check Integration', () => {
  it('should correctly classify a login wall scenario', () => {
    const loginWallHtml = loginWallFixtures.loginToFollowAccount;
    expect(hasLoginWall(loginWallHtml)).toBe(true);
    expect(isPrivateTweet(loginWallHtml)).toBe(false);
  });

  it('should correctly classify a protected account scenario', () => {
    const protectedHtml = protectedTweetFixtures.protectedAccount;
    expect(isPrivateTweet(protectedHtml)).toBe(true);
    expect(hasLoginWall(protectedHtml)).toBe(false);
  });

  it('should correctly classify public content', () => {
    const publicHtml = nonAuthFixtures.publicTweet;
    expect(hasLoginWall(publicHtml)).toBe(false);
    expect(isPrivateTweet(publicHtml)).toBe(false);
  });

  it('should correctly identify when auth cookies are present', () => {
    const cookies = [
      { name: 'auth_token', value: 'valid_token' },
      { name: 'ct0', value: 'csrf_token' },
    ];
    expect(hasCookie(cookies, 'auth_token')).toBe(true);
    expect(findAuthCookies(cookies).length).toBeGreaterThan(0);
  });

  it('should correctly identify when auth cookies are absent', () => {
    const cookies = [
      { name: 'session_id', value: 'session123' },
    ];
    expect(hasCookie(cookies, 'auth_token')).toBe(false);
    expect(findAuthCookies(cookies).length).toBe(0);
  });
});
