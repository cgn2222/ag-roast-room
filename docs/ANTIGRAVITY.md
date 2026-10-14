# Roast Room no Google Antigravity 2.0 (Windows)

Guia da versão adaptada. O protocolo, os "brains", a pontuação e a interface web são os do projeto original (`nateherkai/roast-room`); mudou **quem orquestra** o conselho.

## Pré-requisitos

| Item | Versão | Para quê | Custo |
|---|---|---|---|
| Google Antigravity 2.0 (Agent Manager) | instalado | Roda o Chair e os 7 subagentes | Cota do seu plano Antigravity (**sem chave de API**) |
| Node.js | 20 ou mais novo (testado na 24.18) | Servidor da sala web e testes | Grátis |
| Python | opcional (3.x) | Só para o verificador Python original; o Node faz o mesmo | Grátis |
| Navegador | qualquer atual | Sala e PDF | Grátis |

Não há `npm install`: o projeto não tem dependências. O jsPDF e as fontes já estão em `app/public/`.

## Instalação

```powershell
git clone <seu-fork> ag-roast-room
cd ag-roast-room
node -v          # deve mostrar v20 ou maior
npm test         # 19 testes, offline, sem custo (opcional)
```

Abra a **pasta do projeto** no Antigravity (o skill é descoberto em `.agents/skills/roast-room/` e as regras em `AGENTS.md`). Se o Antigravity já estava aberto, reinicie a conversa para ele reler os skills.

## Iniciar a sala (interface web)

```powershell
npm start
```

Abra http://localhost:4730 e deixe a aba aberta. O servidor só escuta em `127.0.0.1`. Se a porta 4730 estiver ocupada: `$env:PORT=4731; npm start`.

Você também pode pedir ao agente: "abra a sala do Roast Room"; ele roda `npm start` em segundo plano.

## Iniciar um debate e obter o veredito

No Agent Manager, na pasta do projeto, escreva em linguagem natural (o `/roast-room` do Claude Code **não existe** no Antigravity, porque comandos de barra customizados não estão documentados na versão instalada):

```
Run the roast-room skill on this decision: I run a coaching business at $30k a month with 15 clients
at $2,000 each. Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000?
Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March.
I'm leaning toward raising for everyone because I'm underpaid.
```

Variações: acrescente "quick" (4 conselheiros, 2 rodadas), "seats hormozi,buffett" (só esses), ou "ask hormozi ..." (um conselheiro, sem pontuação).

O que acontece:
1. O Chair (o agente) pergunta o que faltar no brief (uma única pergunta em lote).
2. Cria `sessions/<data>-<slug>/` com `brief.md` e `council.json`, e avisa se a sala está aberta.
3. Define 7 subagentes `council-*` a partir de `.claude/agents/council-*.md` e roda cada rodada **em paralelo**: Rodada 1 (posições), crux e checagem de unanimidade, Rodada 2 (debate: cada um recebe os cartões dos outros), minuta de resolução, Rodada 3 (voto).
4. Verifica citações, calcula as notas e grava `verdict.md` + `verdict.json`.
5. Mostra um veredito curto no chat. Na sala: **Read the verdict** e **Download PDF**.

A sala toca o debate ao vivo conforme os arquivos aparecem. O veredito completo fica em `sessions/<data>-<slug>/verdict.md`. **Past sessions** reproduz qualquer conselho e baixa o PDF; três exemplos acompanham o repositório.

## Custo e modelos por modo

| Modo | Quem chama o modelo | Credencial | Custo |
|---|---|---|---|
| **Antigravity (padrão)** | Agent Manager (modelo escolhido em *Settings → Model Selection*; subagentes herdam) | Nenhuma extra | Cota do plano. Completo = 21 execuções de subagente (~1M tokens); `quick` ≈ 8 a 12 |
| Viewer / sala | Ninguém: só lê `sessions/` | Nenhuma | Zero |
| API `anthropic` (opcional) | Servidor Node | `ANTHROPIC_API_KEY` | Cobrado na conta Anthropic, ~25 chamadas por conselho |
| API `gemini` (opcional) | Servidor Node | `GEMINI_API_KEY` + `SEAT_MODEL` e `CHAIR_MODEL` | Cobrado na conta Google AI; **não validado ao vivo** |
| API `mock` | Servidor Node, offline | Nenhuma | Zero (texto falso, só para testes/demo) |

O modo API só liga com `COUNCIL_RUNNER=api` no `.env` (copie `.env.example`). Sem isso o servidor recusa `POST /api/council` com 403, então nenhuma chamada paga acontece por acidente.

## Arquitetura

```
Agent Manager ──ativa──► .agents/skills/roast-room/SKILL.md   (o Chair)
   ├─ define_subagent × N: council-<seat>  (persona = .claude/agents/council-<seat>.md, somente leitura)
   ├─ invoke_subagent (um por rodada, todos os assentos em paralelo)
   └─ grava sessions/<data>-<slug>/{brief.md, council.json, round-1..3.md, cruxes.json,
                                    draft-resolution.md, draft.json, verdict.md, verdict.json}
app/server.mjs ── lib/watch.mjs lê a pasta a cada 1 s ──SSE──► app/public (sala, replay, PDF)
(opcional) COUNCIL_RUNNER=api: lib/council.mjs ─► lib/llm.mjs ─► anthropic | gemini | mock
```

Arquivos de configuração do Antigravity:

| Arquivo | Papel | Formato |
|---|---|---|
| `AGENTS.md` | Regras sempre ativas do projeto | Markdown sem frontmatter (limite 24 KB) |
| `.agents/skills/roast-room/SKILL.md` | O protocolo do Chair | Frontmatter `name` + `description` |

Fonte única de verdade, compartilhada com a versão Claude Code (e por isso **mantida em `.claude/`**): `.claude/skills/roast-room/{brains,references,scripts}` e `.claude/agents/council-*.md`. O Antigravity só lê esses arquivos por caminho; nada do Claude Code é executado. Duplicar ~600 KB de brains criaria divergência.

## Diferenças em relação ao original

| Original (Claude Code) | Adaptado (Antigravity) | Por quê |
|---|---|---|
| `/roast-room ...`, `--quick`, `--seats` | Linguagem natural: "run the roast-room skill ... quick" | Slash commands customizados não são documentados no Antigravity instalado |
| `subagent_type: council-<seat>` (arquivos de agente do projeto) | `define_subagent` em runtime com a mesma persona | O Antigravity só tem arquivos de agente dentro de *plugins* (formato não documentado localmente; não inventei) |
| `AskUserQuestion` | `ask_question` | Equivalente |
| Subagentes com ferramentas `Read, Grep, Glob` | Subagentes sem ferramentas de escrita | Equivalente funcional |
| `CLAUDE.md` + `.claude/settings.json` | `AGENTS.md` (o Claude Code continua lendo o seu) | Convenção do Antigravity |
| Verificador `python ...check_quotes.py` | `node app/scripts/check-quotes.mjs` (resultado idêntico, testado) | Windows costuma não ter Python |
| Runner de API só Anthropic | `LLM_PROVIDER` = anthropic, gemini, mock | Evitar dependência obrigatória de um fornecedor |
| Servidor aceitava qualquer Host/Origin | Só `localhost:<porta>` | Impede que uma página externa dispare um conselho pago |
| Checagem de arquivo estático por prefixo | Prefixo + separador | Pastas irmãs como `public-x` passavam |

Preservados sem alteração: os 7 brains, personas, referências de pontuação e relatório, `watch.mjs`, `pdf.js`, estilos, retratos, exemplos de `sessions/`, `.claude/**` e `CLAUDE.md` (a versão Claude Code continua funcionando).

## Limitações conhecidas

- **Independência dos conselheiros**: depende de `define_subagent`/`invoke_subagent`. Sem eles o skill executa os assentos em sequência no mesmo contexto (declarado no veredito), o que enfraquece a independência da Rodada 1.
- Os subagentes são definidos em runtime, então não aparecem como "agentes do projeto" no Antigravity; ficam disponíveis só na conversa em que foram criados.
- A sala mostra os cartões quando a rodada inteira termina (os arquivos são gravados por rodada), não palavra por palavra como no modo API.
- O runner Gemini foi testado só por contrato (fetch simulado), não contra a API real, e exige que você informe os IDs de modelo.
- Qualidade, obediência ao formato dos cartões e custo variam com o modelo escolhido no Antigravity. O Chair reenvia uma vez o cartão incompleto.
- Os conselheiros são simulações a partir de obras públicas; não são as pessoas.

## Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| A sala não mostra o conselho | Servidor desligado ou outra porta | `npm start`; confira `http://localhost:4730/api/seats` |
| Skill não é encontrado | Pasta aberta não é a raiz do projeto | Abra a pasta que contém `.agents/` e reinicie a conversa |
| `EADDRINUSE` | Porta ocupada | `$env:PORT=4731; npm start` |
| 403 `Forbidden` no navegador | Acessando por IP/host diferente de `localhost` | Use `http://localhost:<porta>` |
| PDF não baixa | Bloqueio de download do navegador | Permita downloads para `localhost` |
| Acentos estranhos no console (`Â·`) | Console em cp1252 lendo UTF-8 | Só aparência; os arquivos estão corretos. `chcp 65001` |
