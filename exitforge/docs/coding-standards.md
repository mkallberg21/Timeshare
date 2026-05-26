# Coding Standards

This document describes the coding conventions for the ExitForge codebase. These standards exist to make the codebase consistent, readable, and easy to review — not to create bureaucracy.

**The linter enforces most of these automatically.** When a linter rule isn't possible, it's described here.

---

## TypeScript

### No `any`
```typescript
// ❌
function process(data: any) { ... }

// ✅
function process(data: ContractAnalysis) { ... }
// or, if truly unknown:
function process(data: unknown) {
  if (!isContractAnalysis(data)) throw new Error("...");
  ...
}
```

### Prefer type imports
```typescript
// ❌
import { CaseStatus } from '@exitforge/shared';

// ✅ (enforced by @typescript-eslint/consistent-type-imports)
import type { CaseStatus } from '@exitforge/shared';
```

### Explicit return types on exported functions
```typescript
// ❌
export function calculateFee(mortgage: number, annualFee: number) {
  return (mortgage + annualFee * 5) * 0.07;
}

// ✅
export function calculateFee(mortgage: number, annualFee: number): number {
  return (mortgage + annualFee * 5) * 0.07;
}
```

### No floating promises
Every `Promise` must be awaited or explicitly handled:
```typescript
// ❌
sendEmail(userId);

// ✅
await sendEmail(userId);
// or, if fire-and-forget is intentional:
void sendEmail(userId); // void suppresses the ESLint rule
```

### Use structured logging, not console.log
```typescript
// ❌
console.log('Case created:', caseId);

// ✅ (in NestJS services)
this.logger.log({ message: 'case_created', caseId });
```

---

## NestJS Patterns

### One module per domain, one file per responsibility
```
cases/
  cases.controller.ts     # HTTP layer only — no business logic
  cases.service.ts        # Business logic, database calls
  cases.module.ts         # Wire together
  dto/
    create-case.dto.ts    # Input validation with class-validator
    case-response.dto.ts  # Output shape
```

### DTOs use `class-validator` decorators
```typescript
// ✅
export class CreateCaseDto {
  @IsString()
  @MinLength(2)
  readonly firstName: string;

  @IsNumber()
  @Min(0)
  readonly outstandingMortgage: number;
}
```

### Services are stateless, DI via constructor
```typescript
// ✅
@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}
}
```

### Controller methods never contain business logic
```typescript
// ❌
@Post()
async create(@Body() dto: CreateCaseDto) {
  const fee = (dto.mortgage + dto.annualFee * 5) * 0.07; // logic here ❌
  return this.prisma.case.create({ data: { ...dto, fee } });
}

// ✅
@Post()
async create(@Body() dto: CreateCaseDto): Promise<ApiResponse<Case>> {
  return this.casesService.create(dto);
}
```

---

## Python / FastAPI

### Use `pydantic-settings` for config
```python
# ✅
class Settings(BaseSettings):
    anthropic_api_key: str
    kafka_brokers: str
    model_config = SettingsConfig(env_file=".env")
```

### Use `structlog` for structured JSON logs
```python
# ❌
print(f"Processing case {case_id}")

# ✅
log = structlog.get_logger()
log.info("case_processing_started", case_id=case_id)
```

### Type all function signatures
```python
# ❌
def calculate_fee(mortgage, annual_fee):
    return (mortgage + annual_fee * 5) * 0.07

# ✅
def calculate_fee(mortgage: float, annual_fee: float) -> float:
    return (mortgage + annual_fee * 5) * FEE_RATE
```

### Constants over magic numbers
```python
# ❌
fee = basis * 0.07

# ✅
FEE_RATE: Final[float] = 0.07
fee = basis * FEE_RATE
```

---

## Git Commit Messages

All commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by `commitlint`):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

### Types
| Type | When to use |
|---|---|
| `feat` | New feature visible to users or consuming services |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `chore` | Tooling, CI, dependencies |
| `ci` | GitHub Actions changes |

### Scopes
Valid scopes are defined in `package.json` → `commitlint.rules.scope-enum`:
`case-service`, `intake-service`, `negotiation-service`, `communication-service`, `payment-service`, `legal-service`, `ai-orchestrator`, `document-service`, `ml-service`, `resort-intelligence`, `web`, `admin`, `mobile`, `shared`, `ui`, `api-client`, `infrastructure`, `docs`, `ci`, `deps`, `repo`

### Examples
```
feat(case-service): add attorney assignment endpoint
fix(ai-orchestrator): handle timeout in qualification_scorer node
docs(adr): add ADR-009 for observability stack
chore(deps): upgrade nestjs to 10.4.0
```

---

## File Naming

| Context | Convention | Example |
|---|---|---|
| TypeScript source | `kebab-case.ts` | `cases.service.ts` |
| TypeScript test | `kebab-case.spec.ts` | `cases.service.spec.ts` |
| React components | `PascalCase.tsx` | `CaseStatusBadge.tsx` |
| Python source | `snake_case.py` | `agent_graph.py` |
| Python test | `test_snake_case.py` | `test_agent_graph.py` |
| Env files | `.env.example` in repo, `.env` local only | |
| Migrations | Prisma auto-generates: `20240101_migration_name` | |

---

## Test Naming

Tests use the `describe / it` convention (TypeScript) or `class Test / def test_` (Python):

```typescript
// ✅
describe('CasesService', () => {
  describe('calculateFee', () => {
    it('returns 7% of basis for standard case', () => {
      const fee = service.calculateFee(100_000, 3_000);
      expect(fee).toBe(8_050); // (100000 + 3000*5) * 0.07
    });
  });
});
```

```python
# ✅
def test_calculate_fee_standard_case() -> None:
    fee = calculate_fee(mortgage=100_000, annual_fee=3_000)
    assert fee == pytest.approx(8_050.0)
```

---

## Security

- **Never log PII** (names, emails, SSNs). Log only `userId`, `caseId`, `resortId`
- **Never use `any` for external input** — always validate with a DTO or Pydantic model
- **All external API calls use environment variables** for keys — never hardcode
- **All SQL goes through Prisma** — no raw `$queryRaw` unless absolutely necessary, and even then parameterize it
- **Pre-signed S3 URLs expire in 15 minutes** — do not increase this TTL
- **Stripe webhooks require signature verification** — `stripe.webhooks.constructEvent` before processing
