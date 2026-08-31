#!/usr/bin/env python3
"""
Mila Bot — Gerador de PDF de Auditoria de Segurança
Usa fpdf2 para gerar PDF profissional sem dependências do sistema.
"""

import json
import sys
import io
from datetime import datetime, timezone
from pathlib import Path

# Configura encoding UTF-8 para console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from fpdf import FPDF

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
        return "Data invalida"


def limpar_texto(texto):
    """Remove caracteres Unicode não suportados por fontes padrão."""
    import unicodedata
    # Normaliza e remove caracteres especiais
    texto = unicodedata.normalize('NFKD', texto)
    # Substitui caracteres problemáticos
    substituicoes = {
        '•': '-',  # bullet
        '–': '-',  # en dash
        '—': '--', # em dash
        '‘': "'",  # left single quote
        '’': "'",  # right single quote
        '“': '"',  # left double quote
        '”': '"',  # right double quote
        '…': '...',  # ellipsis
        'ç': 'c',  # cedilla
        'ã': 'a',  # a tilde
        'õ': 'o',  # o tilde
        'Ç': 'C',  # C cedilla
        'Ã': 'A',  # A tilde
        'Õ': 'O',  # O tilde
    }
    for antigo, novo in substituicoes.items():
        texto = texto.replace(antigo, novo)
    # Remove qualquer caractere não-ASCII restante
    texto = ''.join(c if ord(c) < 128 else '?' for c in texto)
    return texto


def calcular_idade(timestamp_ms):
    """Calcula a idade de uma conta em dias."""
    if not timestamp_ms:
        return 0
    agora = datetime.now(timezone.utc).timestamp() * 1000
    return int((agora - timestamp_ms) / (1000 * 60 * 60 * 24))


class SecurityReportPDF(FPDF):
    """Classe para gerar o PDF do relatório de segurança."""

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        """Cabeçalho de cada página."""
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(255, 105, 180)  # Hot pink
        self.cell(0, 10, 'Mila Bot - Relatorio de Auditoria de Seguranca', 0, 1, 'C')
        self.set_draw_color(255, 105, 180)
        self.line(10, 15, 200, 15)
        self.ln(5)

    def footer(self):
        """Rodapé de cada página."""
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Pagina {self.page_no()}/{{nb}}', 0, 0, 'C')

    def section_title(self, title):
        """Título de seção estilizado."""
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(255, 105, 180)
        self.set_fill_color(255, 240, 245)
        self.cell(0, 10, limpar_texto(title), 0, 1, 'L', fill=True)
        self.set_draw_color(255, 215, 0)  # Gold
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def stat_box(self, number, label, color=(255, 105, 180)):
        """Caixa de estatística."""
        x = self.get_x()
        y = self.get_y()

        # Fundo
        self.set_fill_color(255, 240, 245)
        self.set_draw_color(*color)
        self.rect(x, y, 45, 25, 'DF')

        # Número
        self.set_font('Helvetica', 'B', 18)
        self.set_text_color(*color)
        self.set_xy(x, y + 2)
        self.cell(45, 10, str(number), 0, 1, 'C')

        # Label
        self.set_font('Helvetica', '', 7)
        self.set_text_color(100, 100, 100)
        self.set_xy(x, y + 12)
        self.cell(45, 10, label, 0, 1, 'C')

        self.set_xy(x + 50, y)

    def add_table(self, headers, data, col_widths=None):
        """Adiciona uma tabela estilizada."""
        if not col_widths:
            col_widths = [190 / len(headers)] * len(headers)

        # Cabeçalho
        self.set_font('Helvetica', 'B', 9)
        self.set_fill_color(255, 105, 180)
        self.set_text_color(255, 255, 255)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 8, limpar_texto(header), 1, 0, 'C', fill=True)
        self.ln()

        # Dados
        self.set_font('Helvetica', '', 8)
        self.set_text_color(50, 50, 50)
        fill = False
        for row in data:
            if self.get_y() > 260:  # Nova página se necessário
                self.add_page()
                # Re-adiciona cabeçalho
                self.set_font('Helvetica', 'B', 9)
                self.set_fill_color(255, 105, 180)
                self.set_text_color(255, 255, 255)
                for i, header in enumerate(headers):
                    self.cell(col_widths[i], 8, limpar_texto(header), 1, 0, 'C', fill=True)
                self.ln()
                self.set_font('Helvetica', '', 8)
                self.set_text_color(50, 50, 50)

            if fill:
                self.set_fill_color(255, 245, 250)
            else:
                self.set_fill_color(255, 255, 255)

            for i, cell in enumerate(row):
                self.cell(col_widths[i], 7, limpar_texto(str(cell))[:30], 1, 0, 'L', fill=True)
            self.ln()
            fill = not fill

    def add_risk_item(self, message, level="warning"):
        """Adiciona um item de risco."""
        if level == "danger":
            self.set_fill_color(255, 224, 224)
            self.set_draw_color(244, 67, 54)
            icon = "[!]"
        else:
            self.set_fill_color(255, 243, 205)
            self.set_draw_color(255, 193, 7)
            icon = "[*]"

        x = self.get_x()
        y = self.get_y()
        self.line(x, y, x, y + 10)
        self.rect(x + 2, y, 188, 10, 'DF')
        self.set_font('Helvetica', '', 9)
        self.set_text_color(50, 50, 50)
        self.set_xy(x + 5, y + 1)
        self.cell(180, 8, limpar_texto(f"{icon} {message}"), 0, 1)

    def add_recommendation(self, message):
        """Adiciona uma recomendação."""
        x = self.get_x()
        y = self.get_y()
        self.set_fill_color(232, 245, 233)
        self.set_draw_color(76, 175, 80)
        self.line(x, y, x, y + 10)
        self.rect(x + 2, y, 188, 10, 'DF')
        self.set_font('Helvetica', '', 9)
        self.set_text_color(50, 50, 50)
        self.set_xy(x + 5, y + 1)
        self.cell(180, 8, limpar_texto(f"[+] {message}"), 0, 1)


def gerar_pdf():
    """Gera o PDF do relatório de auditoria."""
    print("Gerando Relatorio de Auditoria de Seguranca...")

    # Carrega dados
    seguranca = carregar_json(SEGURANCA_FILE)
    historico = carregar_json(HISTORICO_FILE)

    if not seguranca:
        print("Nenhum dado de seguro encontrado. Execute $securitybreach primeiro.")
        return

    # Cria PDF
    pdf = SecurityReportPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # Título
    pdf.set_font('Helvetica', 'B', 24)
    pdf.set_text_color(255, 105, 180)
    pdf.cell(0, 15, 'Relatorio de Auditoria', 0, 1, 'C')
    pdf.cell(0, 10, 'de Seguranca', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 12)
    pdf.set_text_color(100, 100, 100)
    data_geracao = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")
    pdf.cell(0, 8, f'Gerado em: {data_geracao}', 0, 1, 'C')
    pdf.ln(10)

    # Visão Geral
    pdf.section_title('Visao Geral')

    total_membros = sum(len(d.get("membros", [])) for d in seguranca.values())
    total_bots = sum(len([m for m in d.get("membros", []) if m.get("bot")]) for d in seguranca.values())
    total_humanos = total_membros - total_bots

    pdf.set_x(15)
    pdf.stat_box(total_membros, "Total de Membros")
    pdf.stat_box(total_humanos, "Humanos", (57, 255, 20))
    pdf.stat_box(total_bots, "Bots", (0, 206, 209))
    pdf.ln(20)

    # Servidores Monitorados
    pdf.section_title('Servidores Monitorados')

    headers = ["ID", "Total", "Humanos", "Bots", "Atualizacao"]
    data = []
    for guild_id, dados in seguranca.items():
        membros = dados.get("membros", [])
        bots = len([m for m in membros if m.get("bot")])
        humanos = len(membros) - bots
        atualizacao = formatar_data(dados.get("atualizadoEm"))
        data.append([guild_id[:15], str(len(membros)), str(humanos), str(bots), atualizacao[:16]])

    pdf.add_table(headers, data, [45, 25, 25, 25, 70])
    pdf.ln(10)

    # Análise de Riscos
    pdf.section_title('Analise de Riscos')

    riscos_encontrados = []
    for guild_id, dados in seguranca.items():
        membros = dados.get("membros", [])
        bots = len([m for m in membros if m.get("bot")])
        humanos = len(membros) - bots

        # Contas novas
        contas_novas = [m for m in membros if not m.get("bot") and calcular_idade(m.get("criadoEm")) < 30]
        if contas_novas:
            riscos_encontrados.append({
                'mensagem': f"Servidor {guild_id[:15]}: {len(contas_novas)} conta(s) criada(s) nos ultimos 30 dias",
                'nivel': 'warning'
            })

        # Mais bots que humanos
        if bots > humanos and humanos > 0:
            riscos_encontrados.append({
                'mensagem': f"Servidor {guild_id[:15]}: Mais bots ({bots}) que humanos ({humanos})",
                'nivel': 'danger'
            })

        # Membros sem cargo
        sem_cargo = [m for m in membros if not m.get("bot") and m.get("cargoAlto") == "Sem cargo"]
        if sem_cargo:
            riscos_encontrados.append({
                'mensagem': f"Servidor {guild_id[:15]}: {len(sem_cargo)} membro(s) sem cargo",
                'nivel': 'warning'
            })

    if not riscos_encontrados:
        pdf.add_recommendation("Nenhum risco critico identificado - O servidor esta em boas condicoes")
    else:
        for risco in riscos_encontrados:
            pdf.add_risk_item(risco['mensagem'], risco['nivel'])

    pdf.ln(10)

    # Bots Detectados
    pdf.section_title('Bots Detectados')

    todos_bots = []
    for dados in seguranca.values():
        for m in dados.get("membros", []):
            if m.get("bot"):
                todos_bots.append(m)

    if todos_bots:
        headers = ["Nome", "Tag", "ID", "Cargo"]
        data = []
        for bot in todos_bots[:15]:
            data.append([
                bot.get("nome", "N/A")[:12],
                bot.get("tag", "N/A")[:15],
                bot.get("id", "N/A")[:12],
                bot.get("cargoAlto", "N/A")[:20]
            ])
        pdf.add_table(headers, data, [35, 45, 35, 75])
    else:
        pdf.set_font('Helvetica', 'I', 10)
        pdf.set_text_color(128, 128, 128)
        pdf.cell(0, 10, 'Nenhum bot detectado no cache.', 0, 1, 'C')

    pdf.ln(10)

    # Recomendações
    pdf.add_page()
    pdf.section_title('Recomendacoes de Seguranca')

    recomendacoes = [
        "Ativar 2FA - Garanta que todos os administradores tenham autenticacao de dois fatores",
        "Revisar Cargos - Verifique se todos os membros possuem cargos apropriados",
        "Auditar Bots - Revise os bots instalados e remova qualquer um suspeito",
        "Monitoramento Continuo - Execute $securitybreach regularmente",
        "Sistema de Logs - Configure canais de logs para monitorar acoes importantes",
        "Restringir Convites - Limite quem pode convidar bots para o servidor",
        "Permissoes Minimas - Use o principio do menor privilegio para cargos",
    ]

    for rec in recomendacoes:
        pdf.add_recommendation(rec)

    pdf.ln(15)

    # Rodapé
    pdf.set_font('Helvetica', 'I', 10)
    pdf.set_text_color(255, 105, 180)
    pdf.cell(0, 8, 'Mila Bot - Relatorio de Auditoria de Seguranca', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(128, 128, 128)
    pdf.cell(0, 6, f'Gerado automaticamente em {data_geracao}', 0, 1, 'C')
    pdf.cell(0, 6, 'Este relatorio e confidencial e destinado apenas aos administradores.', 0, 1, 'C')

    # Salva PDF
    data_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    pdf_file = REPORTS_DIR / f"relatorio_seguranca_{data_str}.pdf"

    pdf.output(str(pdf_file))

    print(f"PDF gerado com sucesso: {pdf_file}")
    return pdf_file


if __name__ == "__main__":
    gerar_pdf()
