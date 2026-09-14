# Platform KPI metric definitions

Sourced by `GET /api/v1/admin/kpis` (`app.admin_metric_definitions`) and shown as tooltips on `/admin`.

| Key | Definition |
| --- | ---------- |
| `users` | Count of `app.users` created in the selected window, excluding deleted. |
| `businesses` | Count of `app.organizations` created in the window. |
| `verified_businesses` | Organisations whose `verification = verified` at query time. The verified badge is only set by admin approval. |
| `bookings` | Count of `app.bookings` created in the window. |
| `confirmed_bookings` | Bookings currently confirmed that were created in the window. |
| `open_cases` | Support cases in `open` or `investigating`. |
| `case_backlog_hours` | Mean age in hours of open/investigating cases. |
| `open_quality_issues` | Open `data_quality_issues` rows. |
| `planner_success_rate` | Share of `recommendation_runs` with status `succeeded`. `0` / source `stub` when the planner has not run. |
| `planner_infeasible_rate` | Share of runs with status `infeasible`. |
| `planner_fallback_rate` | Share of runs with status `fallback`. |

Event semantics: counts use row `created_at` in the requested `[from, to)` window unless the definition says "at query time". Planner rates use `recommendation_runs.status` only — the API never invents generation outcomes.
