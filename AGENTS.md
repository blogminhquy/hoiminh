# Đồng bộ với GitHub (bắt buộc)

Máy và GitHub phải luôn là cùng một bản. Mọi phần việc làm theo ba bước:

1. **Trước khi code, kiểm tra repo đã ở bản mới nhất chưa.** Chạy `git fetch origin`, rồi so nhánh đang làm với `origin/main` (và với nhánh từ xa của chính nó nếu có). Nếu đang cũ hơn thì **kéo về trước, rồi mới code**: trên `main` dùng `git pull --ff-only origin main`; trên nhánh làm việc hoặc worktree thì kéo bản mới của `origin/main` vào nhánh. Không code trên bản cũ.
2. **Code xong thì luôn push lên GitHub**, để GitHub có bản mới nhất và máy khớp với GitHub. Không để việc đã xong chỉ nằm trên máy: sau khi push, `git status -sb` không được còn `ahead`. Khi thay đổi đã vào `main` trên GitHub thì kéo `main` về repo chính.
3. **Không tự ý ghi đè khi không đồng bộ được.** Có thay đổi chưa commit chặn việc kéo về, hoặc máy và GitHub đã rẽ nhánh (không fast-forward được) thì dừng lại và báo chủ dự án. Không dùng `--force` hay `reset --hard` để cho khớp khi chưa được đồng ý.

# Làm song song nhiều phiên (bổ sung ngày 2026-11-21)

Nhiều phiên cùng làm một lúc, mỗi phiên một nhánh và một PR. Các luật dưới đây giữ cho các phiên không dẫm chân nhau. CI kiểm luật 3 và 5 ở mọi PR (bước "Luật làm song song"); chạy tại máy bằng `pnpm check:parallel`.

1. **Một phiên, một nhánh, một PR, một việc.** Không push vào nhánh của phiên khác, không commit thẳng lên `main`. Việc mới thì nhánh mới, tách từ `origin/main` mới nhất, không tách từ nhánh của phiên khác.
2. **Hai phiên không dùng chung một thư mục làm việc.** Trên cùng một máy, mỗi phiên một worktree riêng (`git worktree add`). Chung thư mục thì phiên này đổi nhánh dưới chân phiên kia, hoặc commit nhầm phần phiên kia đang sửa dở.
3. **Phiên làm việc không tự đặt số phiên bản.** Không sửa `version` trong `package.json`, không sửa `packages/config/src/version.ts`, không viết vào `CHANGELOG.md`, không thêm mục đánh số vào `DECISIONS.md`. Bốn tệp này mọi nhánh cùng sửa, nên hai nhánh song song luôn xung đột ở đó và hay nhận trùng số. Thay vào đó viết một phiếu `changes/<tên-nhánh>.md` (mẫu ở `changes/README.md`): mức tăng, phần sẽ vào CHANGELOG, quyết định mới nếu có. PR sửa mã trong `apps/` hoặc `packages/` bắt buộc có phiếu. Tên PR lúc này chưa mang số phiên bản.
4. **Số phiên bản chỉ do phiên merge đóng, ngay trước khi merge**, bằng `pnpm version:stamp` (xem Luật merge trong `CLAUDE.md`). Lúc đó mới biết chắc số kế tiếp là số nào.
5. **Migration database không gỡ xung đột bằng tay.** Migration đã vào `main` thì không sửa, không xóa: muốn đổi thì viết migration mới. Nhánh có migration mà `main` vừa nhận thêm migration khác: xóa migration của nhánh (tệp `.sql`, snapshot, dòng trong `_journal.json`), kéo `main` về, chạy lại `pnpm db:generate` để lấy số và mốc thời gian mới. Lý do: drizzle chỉ áp migration có mốc thời gian lớn hơn migration đã áp cuối cùng, nên một migration tạo trước mà merge sau sẽ bị database thật bỏ qua mà không báo gì.
6. **Trước khi code, xem các PR đang mở đụng tệp nào.** Việc sắp làm mà sửa cùng tệp hoặc cùng khối nghiệp vụ với một PR đang mở thì báo chủ dự án trước khi code, nêu rõ PR nào và tệp nào, để chủ dự án chọn: chờ PR kia merge trước, hay vẫn làm song song và nhánh merge sau tự kéo `main` về gỡ.
7. **Xung đột ở mã thì gỡ bằng cách hiểu cả hai bên.** Kéo `origin/main` vào nhánh (không rebase, không force), đọc thay đổi của bên kia, giữ đủ ý của cả hai, rồi chạy lại `pnpm check`. Không chắc ý của bên kia thì dừng và báo chủ dự án, không chọn bừa một bên.
8. **PR nhỏ, merge sớm.** Nhánh sống càng lâu càng lệch `main` và càng dễ đụng nhánh khác. Việc lớn thì chia thành nhiều PR chạy được độc lập.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **hoiminh** (4865 symbols, 12586 relationships, 415 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/hoiminh/context` | Codebase overview, check index freshness |
| `gitnexus://repo/hoiminh/clusters` | All functional areas |
| `gitnexus://repo/hoiminh/processes` | All execution flows |
| `gitnexus://repo/hoiminh/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
