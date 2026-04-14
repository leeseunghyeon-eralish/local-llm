#!/bin/bash
# .claude/hooks/check-git-branch.sh
# PreToolUse hook: main/master 브랜치에서 git commit/push를 차단한다.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE '(^|\s|&&|;)\s*git\s+(commit|push)'; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

  if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    jq -n \
      --arg branch "$CURRENT_BRANCH" \
      '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("ERROR: Direct commits/pushes to " + $branch + " are forbidden.\nCreate a feature branch first: git checkout -b feature/{phase}-{description}\nThen commit and push on the feature branch.")
        }
      }'
    exit 0
  fi
fi

exit 0
