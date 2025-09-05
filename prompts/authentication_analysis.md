<!--  Authentication Analysis Prompt  -->

<task>
  Determine how authentication is handled in the target codebase.
  Produce a single JSON object as described in <output_format>.
  Use the multi-tool strategy in <execution_plan>.
</task>

<execution_plan>
  1. Repository identification
     a. Use tb__sgcs-list-repos to identify the repository name and current commit hash for tracking.

  2. Authentication analysis
     a. Search for authentication-related code using keywords such as:
        "signin", "jwt.verify", "oauth2", "@PreAuthorize", "authenticate", "login", "auth"
     b. Examine authentication middleware, handlers, and configuration files
     c. Identify authentication patterns and security implementations
     d. Use available tools: tb__sgcs-list-repos, tb__sgcs-list-files, tb__sgcs-read-file,
        tb__sgcs-keyword-search, tb__sgcs-nls-search, tb__sgcs-go-to-definition,
        tb__sgcs-find-references, tb__sgcs-commit-search, tb__sgcs-diff-search,
        tb__sgcs-get-code-owners, tb__sgcs-get-contributor-repos.
        NO local file system access is available.

  3. Analysis and classification
     a. Apply decision rules in <auth_type_rules> to classify the authentication type
     b. Include repository metadata (name and commit) for tracking
     c. Compose the final JSON response required in <output_format>
     d. If evidence is conflicting or unclear, you MAY consult the oracle for synthesis before finalizing.
</execution_plan>

<auth_type_rules>
  modern_auth : Clear evidence of modern authentication using OAuth 2.0, JWT tokens,
                or similar industry-standard protocols with proper security practices
                (secure token handling, refresh mechanisms, etc.).

  legacy_auth : Authentication present but using outdated methods like basic auth,
                session cookies without proper security, or custom authentication
                schemes without modern security standards.

  no_auth     : Clear evidence that authentication is explicitly disabled or
                absent, and no fallback auth is observed.  

  mixed       : Some endpoints use modern auth while others use legacy methods
                or no authentication (inconsistent implementation).

  uncertain   : Use ONLY when the available evidence is
                • ambiguous OR contradictory, OR
                • insufficient because critical code areas were inaccessible,
                obfuscated, or outside the repository.  
                Include explicit reasons in notes when choosing this value.
</auth_type_rules>

<output_format>
  Produce exactly one JSON object with these keys:
  {
    "repo_name"       : "<string>  // Repository name (e.g., 'acme/payment-service' or path)",
    "commit_hash"     : "<string>  // Current commit SHA (40 chars) or branch name",
    "auth_type"       : "modern_auth" | "legacy_auth" | "no_auth" | "mixed" | "uncertain",
    "reasons"         : "<short paragraph explaining the decision>",
    "evidence_samples": ["<code_or_comment_snippet>", ...]// ≤ 5 short snippets
  }
</output_format>

<constraints>
  • The JSON object MUST be the only thing in the final answer.  
  • Do NOT include XML, commentary, or markdown in the final answer.
  • Your response must start with { and end with } - nothing else.
  • Do NOT wrap the JSON in code blocks or markdown formatting.
  • Do NOT provide explanations, summaries, or additional text.
  • Limit each evidence snippet to ≤ 200 characters, strip newlines.  
  • Always include repo_name and commit_hash for tracking and verification.
  • For repository/code access, ONLY use tb__sgcs-* tools. No local file system access.
</constraints>

<failure_policy>
  If you determine the tb__sgcs-* tools are not available in your toolset:
  - Immediately stop the task and output a single line starting with "FAIL:" that explains the missing tools (e.g., "FAIL: tb__sgcs-* tools unavailable; cannot perform repository analysis.").
  - Do not attempt any repository access using other tools.
  - Do not produce the JSON output described in <output_format>.
</failure_policy>
