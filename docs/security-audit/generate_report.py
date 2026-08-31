#!/usr/bin/env python3
"""
Mila Bot — Relatório de Auditoria de Segurança
Gera um PDF profissional com análise dos dados de segurança do servidor.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

# ── Caminhos ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "docs" / "reports"
SEGURANCA_FILE = DATA_DIR / "seguranca.json"
HISTORICO_FILE = DATA_DIR / "historico.json"

# Garante que a pasta de relatórios existe
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def carregar_json(caminho):
    """Carrega um arquivo JSON com tratamento de erro."""
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def formatar_data(timestamp_ms):
    """Converte timestamp em milissegundos para data legível."""
    if not timestamp_ms:
        return "Desconhecido"
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
        return dt.strftime("%d/%m/%Y %H:%M")
    except (OSError, ValueError):
        return "Data inválida"


def calcular_idade(timestamp_ms):
    """Calcula a idade de uma conta em dias."""
    if not timestamp_ms:
        return 0
    agora = datetime.now(timezone.utc).timestamp() * 1000
    return int((agora - timestamp_ms) / (1000 * 60 * 60 * 24))


def analisar_servidor(guild_id, dados):
    """Analisa os dados de um servidor e retorna estatísticas."""
    membros = dados.get("membros", [])
    total = len(membros)
    bots = [m for m in membros if m.get("bot", False)]
    humanos = [m for m in membros if not m.get("bot", False)]

    # Contas novas (menos de 30 dias)
    contas_novas = [m for m in humanos if calcular_idade(m.get("criadoEm")) < 30]

    # Contas muito antigas (mais de 5 anos)
    contas_antigas = [m for m in humanos if calcular_idade(m.get("criadoEm")) > 1825]

    # Membros sem cargo
    sem_cargo = [m for m in humanos if m.get("cargoAlto") == "Sem cargo"]

    # Análise de cargos
    cargos = {}
    for m in humanos:
        cargo = m.get("cargoAlto", "Sem cargo")
        cargos[cargo] = cargos.get(cargo, 0) + 1

    return {
        "total": total,
        "bots": len(bots),
        "humanos": len(humanos),
        "contas_novas": contas_novas,
        "contas_antigas": contas_antigas,
        "sem_cargo": sem_cargo,
        "cargos": cargos,
        "bots_lista": bots,
        "humanos_lista": humanos,
    }


def gerar_html_relatorio(seguranca, historico):
    """Gera o HTML do relatório de auditoria."""
    data_geracao = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")

    # Análise consolidada
    todos_bots = []
    todos_humanos = []
    servidores_info = []

    for guild_id, dados in seguranca.items():
        analise = analisar_servidor(guild_id, dados)
        servidores_info.append({
            "id": guild_id,
            "total": analise["total"],
            "bots": analise["bots"],
            "humanos": analise["humanos"],
            "contas_novas": len(analise["contas_novas"]),
            "contas_antigas": len(analise["contas_antigas"]),
            "sem_cargo": len(analise["sem_cargo"]),
            "cargos": analise["cargos"],
            "atualizado": dados.get("atualizadoEm"),
        })
        todos_bots.extend(analise["bots_lista"])
        todos_humanos.extend(analise["humanos_lista"])

    total_membros = sum(s["total"] for s in servidores_info)
    total_bots = sum(s["bots"] for s in servidores_info)
    total_humanos = sum(s["humanos"] for s in servidores_info)
    total_contas_novas = sum(s["contas_novas"] for s in servidores_info)

    # Gera HTML
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Auditoria de Segurança — Mila Bot</title>
    <style>
        @page {{
            size: A4;
            margin: 20mm;
        }}
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 40px;
        }}
        .header {{
            text-align: center;
            border-bottom: 3px solid #FF69B4;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #FF69B4;
            font-size: 28px;
            margin-bottom: 10px;
        }}
        .header .subtitle {{
            color: #666;
            font-size: 14px;
        }}
        .section {{
            margin-bottom: 30px;
            page-break-inside: avoid;
        }}
        .section h2 {{
            color: #FF69B4;
            border-bottom: 2px solid #FFD700;
            padding-bottom: 8px;
            margin-bottom: 15px;
            font-size: 20px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }}
        .stat-card {{
            background: linear-gradient(135deg, #FFF0F5 0%, #FFE4E1 100%);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            border: 1px solid #FFB6C1;
        }}
        .stat-card .number {{
            font-size: 32px;
            font-weight: bold;
            color: #FF69B4;
            display: block;
        }}
        .stat-card .label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .warning-card {{
            background: linear-gradient(135deg, #FFF3CD 0%, #FFEAA7 100%);
            border-color: #FFC107;
        }}
        .warning-card .number {{
            color: #FF9800;
        }}
        .danger-card {{
            background: linear-gradient(135deg, #FFE0E0 0%, #FFCDD2 100%);
            border-color: #F44336;
        }}
        .danger-card .number {{
            color: #F44336;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 13px;
        }}
        th, td {{
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #FF69B4;
            color: white;
            font-weight: 600;
        }}
        tr:nth-child(even) {{
            background: #FFF0F5;
        }}
        tr:hover {{
            background: #FFE4E1;
        }}
        .badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}
        .badge-success {{ background: #39FF14; color: #000; }}
        .badge-warning {{ background: #FFC107; color: #000; }}
        .badge-danger {{ background: #FF0044; color: #fff; }}
        .badge-info {{ background: #00CED1; color: #fff; }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #FF69B4;
            text-align: center;
            color: #999;
            font-size: 12px;
        }}
        .risk-item {{
            background: #FFF3CD;
            border-left: 4px solid #FFC107;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
        }}
        .risk-item.high {{
            background: #FFE0E0;
            border-left-color: #F44336;
        }}
        .recommendation {{
            background: #E8F5E9;
            border-left: 4px solid #4CAF50;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Relatório de Auditoria de Segurança</h1>
        <div class="subtitle">
            <strong>Mila Bot</strong> — Análise de Segurança do Servidor<br>
            Gerado em: {data_geracao}
        </div>
    </div>

    <div class="section">
        <h2>📊 Visão Geral</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <span class="number">{total_membros}</span>
                <span class="label">Total de Membros</span>
            </div>
            <div class="stat-card">
                <span class="number">{total_humanos}</span>
                <span class="label">Humanos</span>
            </div>
            <div class="stat-card">
                <span class="number">{total_bots}</span>
                <span class="label">Bots</span>
            </div>
            <div class="stat-card warning-card">
                <span class="number">{total_contas_novas}</span>
                <span class="label">Contas Novas (&lt;30 dias)</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🏢 Servidores Monitorados</h2>
        <table>
            <thead>
                <tr>
                    <th>ID do Servidor</th>
                    <th>Total</th>
                    <th>Humanos</th>
                    <th>Bots</th>
                    <th>Contas Novas</th>
                    <th>Última Atualização</th>
                </tr>
            </thead>
            <tbody>
"""

    for s in servidores_info:
        html += f"""                <tr>
                    <td><code>{s['id']}</code></td>
                    <td>{s['total']}</td>
                    <td>{s['humanos']}</td>
                    <td>{s['bots']}</td>
                    <td>{s['contas_novas']}</td>
                    <td>{formatar_data(s['atualizado'])}</td>
                </tr>
"""

    html += """            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>⚠️ Análise de Riscos</h2>
"""

    # Verifica riscos
    riscos_encontrados = []

    for s in servidores_info:
        if s['contas_novas'] > 0:
            riscos_encontrados.append({
                'tipo': 'warning',
                'mensagem': f"Servidor {s['id']}: {s['contas_novas']} conta(s) criada(s) nos últimos 30 dias"
            })

        if s['bots'] > s['humanos'] and s['humanos'] > 0:
            riscos_encontrados.append({
                'tipo': 'danger',
                'mensagem': f"Servidor {s['id']}: Mais bots ({s['bots']}) que humanos ({s['humanos']})"
            })

        if s['sem_cargo'] > 0:
            riscos_encontrados.append({
                'tipo': 'warning',
                'mensagem': f"Servidor {s['id']}: {s['sem_cargo']} membro(s) sem cargo atribuído"
            })

    if not riscos_encontrados:
        html += """        <div class="recommendation">
            ✅ <strong>Nenhum risco crítico identificado</strong> — O servidor está em boas condições de segurança.
        </div>
"""
    else:
        for risco in riscos_encontrados:
            classe = "high" if risco['tipo'] == 'danger' else ""
            html += f"""        <div class="risk-item {classe}">
            ⚠️ {risco['mensagem']}
        </div>
"""

    html += """    </div>

    <div class="section">
        <h2>🤖 Bots Detectados</h2>
        <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Tag</th>
                    <th>ID</th>
                    <th>Cargo Alto</th>
                    <th>Criado em</th>
                </tr>
            </thead>
            <tbody>
"""

    for bot in todos_bots[:20]:  # Limita a 20 bots
        html += f"""                <tr>
                    <td>{bot.get('nome', 'N/A')}</td>
                    <td>{bot.get('tag', 'N/A')}</td>
                    <td><code>{bot.get('id', 'N/A')}</code></td>
                    <td>{bot.get('cargoAlto', 'N/A')}</td>
                    <td>{formatar_data(bot.get('criadoEm'))}</td>
                </tr>
"""

    html += """            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>👤 Membros Humanos (Amostra)</h2>
        <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Tag</th>
                    <th>ID</th>
                    <th>Cargo Alto</th>
                    <th>Idade (dias)</th>
                </tr>
            </thead>
            <tbody>
"""

    for membro in todos_humanos[:30]:  # Limita a 30 membros
        idade = calcular_idade(membro.get('criadoEm'))
        classe_idade = ""
        if idade < 30:
            classe_idade = ' style="color: #FF9800; font-weight: bold;"'
        elif idade > 1825:
            classe_idade = ' style="color: #4CAF50;"'

        html += f"""                <tr>
                    <td>{membro.get('nome', 'N/A')}</td>
                    <td>{membro.get('tag', 'N/A')}</td>
                    <td><code>{membro.get('id', 'N/A')}</code></td>
                    <td>{membro.get('cargoAlto', 'N/A')}</td>
                    <td{classe_idade}>{idade}</td>
                </tr>
"""

    html += """            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📋 Recomendações de Segurança</h2>
        <div class="recommendation">
            🔐 <strong>Ativar 2FA</strong> — Garanta que todos os administradores tenham autenticação de dois fatores habilitada.
        </div>
        <div class="recommendation">
            👥 <strong>Revisar Cargos</strong> — Verifique se todos os membros possuem cargos apropriados e permissões mínimas necessárias.
        </div>
        <div class="recommendation">
            🤖 <strong>Auditar Bots</strong> — Revise os bots instalados e remova qualquer um que não esteja em uso ou pareça suspeito.
        </div>
        <div class="recommendation">
            📊 <strong>Monitoramento Contínuo</strong> — Execute o comando $securitybreach regularmente para manter o cache atualizado.
        </div>
        <div class="recommendation">
            🚨 <strong>Sistema de Logs</strong> — Configure canais de logs para monitorar ações importantes no servidor.
        </div>
    </div>

    <div class="footer">
        <p>⭐｡°✩ Mila Bot — Relatório de Auditoria de Segurança ⋆｡°✩</p>
        <p>Gerado automaticamente em {data_geracao}</p>
        <p>Este relatório é confidencial e destinado apenas aos administradores do servidor.</p>
    </div>
</body>
</html>"""

    return html


def main():
    """Função principal para gerar o relatório."""
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🛡️ Gerando Relatório de Auditoria de Segurança...")
    print(f"📂 Dados: {SEGURANCA_FILE}")
    print(f"📁 Relatórios: {REPORTS_DIR}")

    # Carrega dados
    seguranca = carregar_json(SEGURANCA_FILE)
    historico = carregar_json(HISTORICO_FILE)

    if not seguranca:
        print("⚠️ Nenhum dado de segurança encontrado. Execute $securitybreach primeiro.")
        return

    # Gera HTML
    html = gerar_html_relatorio(seguranca, historico)

    # Salva HTML
    data_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    html_file = REPORTS_DIR / f"relatorio_seguranca_{data_str}.html"

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ Relatório HTML gerado: {html_file}")
    print(f"📄 Para converter em PDF, abra o arquivo no navegador e use Ctrl+P → Salvar como PDF")
    print(f"💡 Ou use: python -m weasyprint {html_file} {html_file.with_suffix('.pdf')}")

    return html_file


if __name__ == "__main__":
    main()
