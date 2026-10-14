# Relatório final: Roast Room adaptado ao Antigravity 2.0

Data: 2026-10-14. Base: fork local de `nateherkai/roast-room` (commit `f5e7b63`), Windows, Node 24.18, Python 3.11. Nada foi commitado; as mudanças estão na árvore de trabalho e podem ser revertidas com `git checkout -- .` e remoção dos arquivos novos.

## O que foi feito

1. **Chair nativo do Antigravity**: `.agents/skills/roast-room/SKILL.md` (frontmatter `name` + `description`, único formato documentado). Usa `ask_question`, `define_subagent` e `invoke_subagent` (7 assentos em paralelo por rodada), grava os mesmos arquivos de sessão que a sala já lê, verifica citações e escreve o veredito. Tem fallback sequencial se os subagentes não existirem.
2. **Regras do projeto**: `AGENTS.md` (equivalente do `CLAUDE.md`, que foi preservado).
3. **Runner de API sem dependência de um fornecedor**: `app/lib/llm.mjs` escolhe `anthropic` (comportamento original), `gemini` (opt-in) ou `mock` (offline). `systemFor()` passou a devolver string; o provedor Anthropic reaplica o cache de prompt.
4. **Verificador de citações em Node** (`app/scripts/check-quotes.mjs`), com resultado idêntico ao script Python (27/27 verificadas no exemplo).
5. **Segurança do servidor**: validação de `Host`/`Origin` (bloqueia DNS rebinding e disparo cross-site de conselhos pagos) e checagem de caminho estático com separador.
6. **UI e docs neutros** quanto ao agente; `README.md`, `.env.example` e `docs/ANTIGRAVITY.md` (guia Windows em português).
7. **19 testes** offline (`npm test`).

## Arquivos

| Ação | Arquivo |
|---|---|
| Criados | `.agents/skills/roast-room/SKILL.md`, `AGENTS.md`, `app/lib/{llm,gemini,mock,schema}.mjs`, `app/scripts/check-quotes.mjs`, `test/{helpers,viewer,council,server,gemini,quotes}*.mjs`, `docs/ANTIGRAVITY.md`, `docs/RELATORIO-FINAL.md` |
| Modificados | `app/lib/{anthropic,council,env,seats,watch}.mjs`, `app/server.mjs`, `app/public/{app.js,index.html}` (só textos), `app/scripts/smoke.mjs`, `package.json`, `.env.example`, `README.md` |
| Preservados | `.claude/**` (brains, personas, referências, script Python, settings), `CLAUDE.md`, `sessions/**`, `app/public/{pdf.js,styles.css,vendor,brand,portraits}`, `LICENSE` |

## Testes executados

| Verificação | Resultado |
|---|---|
| `npm test` (19 testes) | **19 passam**, 2 execuções |
| Replay de pasta de skill (exemplo) até o veredito: 7 assentos x 3 rodadas, notas = média ponderada | passa |
| Debate completo no provedor `mock`: setup, R1, cruxes, R2, minuta, R3, veredito, arquivos salvos; `quick` com 4 assentos | passa |
| Rodada 2 recebe os cartões dos 7 assentos e os cruxes; Rodada 3 recebe a minuta (deliberação, não monólogos) | passa |
| Servidor sobe, serve sala/seats/sessões/PDF, recusa `POST /api/council` em modo viewer, recusa Host/Origin externos, não serve fora de `public/` | passa |
| Contrato Gemini com `fetch` simulado (chave em header, schema, erro em `MAX_TOKENS`, exige IDs de modelo) | passa |
| Verificador de citações: exemplo limpo; citação inventada é sinalizada; paridade com Python | passa |
| **PDF no navegador** (Chrome, sala real): os 3 exemplos geraram PDFs válidos (`%PDF-`, 2 a 3 páginas, ~110 KB), sem erros no console | passa |
| **Assento real no Antigravity**: `define_subagent` + `invoke_subagent` com a persona e o brain do Buffett produziram um cartão completo; `parseCard` extraiu notas A5/B8/C3, pilar 8, confiança 3; a citação `(S028)` foi verificada no brain | passa |

## Não testado, e por quê

- **Um conselho completo de 21 subagentes no Antigravity.** Gastaria ~1M tokens da sua cota sem você ter pedido; validei uma execução real de assento, o pipeline completo no `mock` e o replay dos exemplos. Recomendo rodar um `quick` seu para validar de ponta a ponta (≈8 a 12 execuções).
- **Provedor Gemini contra a API real**: exige chave e IDs de modelo seus (custo). Só contrato simulado.
- **Provedor Anthropic ao vivo**: não executado (sem chave); a alteração foi mínima (string → bloco com `cache_control` no mesmo formato de antes).
- **Reinício do Antigravity / descoberta do skill pelo Agent Manager**: o formato segue a documentação instalada, mas não reiniciei o aplicativo.

## Decisões e justificativas

- **Brains e referências ficam em `.claude/`**: fonte única, 600 KB sem duplicar; o Antigravity lê por caminho. Mover quebraria a versão Claude Code.
- **Sem `/roast-room` no Antigravity**: slash commands customizados não estão documentados; o skill é ativado por linguagem natural.
- **Subagentes em runtime**: arquivos de agente só existem em *plugins* com formato não documentado localmente; não inventei.
- **Padrão sem custo extra**: modo viewer + Antigravity; o modo API só liga com `COUNCIL_RUNNER=api` e o servidor responde 403 caso contrário.
- **Gemini sem modelo padrão**: o app se recusa a adivinhar IDs de modelo (e custo).

## Pendências e riscos

1. Rodar um conselho `quick` real e confirmar o tempo e a cota consumida.
2. A sala mostra os cartões por rodada (arquivos gravados quando a rodada termina), não palavra por palavra.
3. `.claude/skills/roast-room/references/round-prompts.md` ainda cita "Agent type" (Claude); o SKILL do Antigravity diz para ignorar esse parágrafo. Não editei para não divergir do original.
4. Se `define_subagent` mudar de nome ou semântica em outra versão do Antigravity, ajuste a seção "Seat runtime" do SKILL; o fallback sequencial continua valendo.
5. Nenhum commit foi feito. Revise `git diff` e faça o commit quando quiser.
