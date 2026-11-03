import pygame
import math
from collections import deque

# =========================================================
# FORD-FULKERSON / EDMONDS-KARP VISUALIZER
# Minimalist Modern UI + Animations
# =========================================================

pygame.init()

WIDTH, HEIGHT = 1400, 850
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Network Flow Visualizer")

clock = pygame.time.Clock()

# =========================================================
# COLORS
# =========================================================

BG = (18, 18, 22)
PANEL = (28, 28, 34)
CARD = (36, 36, 44)

WHITE = (245, 245, 245)
SOFT = (180, 180, 190)
MUTED = (120, 120, 130)

BLUE = (90, 170, 255)
CYAN = (0, 220, 255)
GREEN = (0, 210, 140)
RED = (255, 90, 90)
YELLOW = (255, 210, 70)

EDGE = (90, 90, 105)

# =========================================================
# FONTS
# =========================================================

FONT = pygame.font.SysFont("Segoe UI", 18)
FONT_SMALL = pygame.font.SysFont("Segoe UI", 15)
FONT_BIG = pygame.font.SysFont("Segoe UI", 26)
FONT_TITLE = pygame.font.SysFont("Segoe UI", 38, bold=True)

# =========================================================
# HELPERS
# =========================================================

def lerp(a, b, t):
    return a + (b - a) * t

def draw_text(text, font, color, pos):
    surf = font.render(text, True, color)
    screen.blit(surf, pos)

def draw_arrow(start, end, color, width=3):
    pygame.draw.line(screen, color, start, end, width)

    angle = math.atan2(end[1] - start[1], end[0] - start[0])

    size = 12

    p1 = (
        end[0] - size * math.cos(angle - math.pi / 6),
        end[1] - size * math.sin(angle - math.pi / 6)
    )

    p2 = (
        end[0] - size * math.cos(angle + math.pi / 6),
        end[1] - size * math.sin(angle + math.pi / 6)
    )

    pygame.draw.polygon(screen, color, [end, p1, p2])

# =========================================================
# BUTTON
# =========================================================

class Button:
    def __init__(self, x, y, w, h, text, color=BLUE):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.color = color
        self.hover = False

    def draw(self):
        mouse = pygame.mouse.get_pos()
        self.hover = self.rect.collidepoint(mouse)

        base = self.color

        if self.hover:
            fill = (
                min(base[0] + 30, 255),
                min(base[1] + 30, 255),
                min(base[2] + 30, 255)
            )
        else:
            fill = base

        pygame.draw.rect(screen, fill, self.rect, border_radius=14)

        text = FONT.render(self.text, True, WHITE)
        screen.blit(text, text.get_rect(center=self.rect.center))

    def clicked(self, pos):
        return self.rect.collidepoint(pos)

# =========================================================
# NODE
# =========================================================

class Node:
    RADIUS = 28

    def __init__(self, i, x, y):
        self.id = i
        self.pos = pygame.Vector2(x, y)
        self.dragging = False
        self.pulse = 0

    def draw(self):
        self.pulse += 0.05

        glow = int(6 * abs(math.sin(self.pulse)))

        pygame.draw.circle(
            screen,
            (40, 60, 100),
            self.pos,
            self.RADIUS + glow
        )

        color = BLUE

        if self.id == 0:
            color = GREEN

        pygame.draw.circle(screen, color, self.pos, self.RADIUS)

        pygame.draw.circle(screen, WHITE, self.pos, self.RADIUS, 2)

        label = FONT_BIG.render(str(self.id), True, WHITE)
        screen.blit(label, label.get_rect(center=self.pos))

    def hit(self, pos):
        return self.pos.distance_to(pos) <= self.RADIUS

# =========================================================
# EDGE
# =========================================================

class Edge:
    def __init__(self, u, v, cap):
        self.u = u
        self.v = v
        self.cap = cap

        self.flow = 0

        self.highlight = False
        self.anim_progress = 0

    def draw(self, nodes):
        a = nodes[self.u].pos
        b = nodes[self.v].pos

        direction = (b - a).normalize()

        start = a + direction * Node.RADIUS
        end = b - direction * Node.RADIUS

        color = CYAN if self.highlight else EDGE
        width = 5 if self.highlight else 3

        draw_arrow(start, end, color, width)

        # animated flow particles
        if self.flow > 0:
            self.anim_progress += 0.01 * max(1, self.flow)

            t = (math.sin(self.anim_progress) + 1) / 2

            px = lerp(start.x, end.x, t)
            py = lerp(start.y, end.y, t)

            pygame.draw.circle(screen, GREEN, (int(px), int(py)), 7)

        # capacity label
        mid = (start + end) / 2

        box = pygame.Rect(mid.x - 34, mid.y - 16, 68, 32)

        pygame.draw.rect(screen, PANEL, box, border_radius=10)
        pygame.draw.rect(screen, color, box, 2, border_radius=10)

        txt = FONT.render(f"{self.flow}/{self.cap}", True, WHITE)
        screen.blit(txt, txt.get_rect(center=box.center))

# =========================================================
# INPUT POPUP
# =========================================================

class Popup:
    def __init__(self, prompt):
        self.prompt = prompt
        self.text = ""

        self.rect = pygame.Rect(WIDTH // 2 - 180, HEIGHT // 2 - 100, 360, 200)

        self.ok = pygame.Rect(self.rect.x + 40, self.rect.y + 130, 120, 40)
        self.cancel = pygame.Rect(self.rect.x + 200, self.rect.y + 130, 120, 40)

    def draw(self):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 140))
        screen.blit(overlay, (0, 0))

        pygame.draw.rect(screen, PANEL, self.rect, border_radius=20)
        pygame.draw.rect(screen, CYAN, self.rect, 2, border_radius=20)

        draw_text(self.prompt, FONT_BIG, WHITE, (self.rect.x + 30, self.rect.y + 30))

        input_rect = pygame.Rect(self.rect.x + 30, self.rect.y + 75, 300, 40)

        pygame.draw.rect(screen, CARD, input_rect, border_radius=10)
        pygame.draw.rect(screen, WHITE, input_rect, 2, border_radius=10)

        draw_text(self.text, FONT_BIG, WHITE, (input_rect.x + 10, input_rect.y + 7))

        pygame.draw.rect(screen, GREEN, self.ok, border_radius=10)
        pygame.draw.rect(screen, RED, self.cancel, border_radius=10)

        draw_text("Confirm", FONT, WHITE, (self.ok.x + 28, self.ok.y + 10))
        draw_text("Cancel", FONT, WHITE, (self.cancel.x + 35, self.cancel.y + 10))

    def handle(self, event):
        if event.type == pygame.KEYDOWN:

            if event.key == pygame.K_BACKSPACE:
                self.text = self.text[:-1]

            elif event.unicode.isdigit():
                self.text += event.unicode

        if event.type == pygame.MOUSEBUTTONDOWN:

            if self.ok.collidepoint(event.pos):
                return "ok"

            if self.cancel.collidepoint(event.pos):
                return "cancel"

        return None

# =========================================================
# EDMONDS-KARP WITH ANIMATION STEPS
# =========================================================

def edmonds_karp_steps(n, edges, s, t):

    cap = [[0] * n for _ in range(n)]

    edge_lookup = {}

    for e in edges:
        cap[e.u][e.v] += e.cap
        edge_lookup[(e.u, e.v)] = e

    steps = []

    max_flow = 0

    while True:

        parent = [-1] * n
        parent[s] = s

        q = deque([s])

        while q and parent[t] == -1:

            u = q.popleft()

            for v in range(n):

                if parent[v] == -1 and cap[u][v] > 0:
                    parent[v] = u
                    q.append(v)

        if parent[t] == -1:
            break

        path = []

        inc = float("inf")

        v = t

        while v != s:
            u = parent[v]
            path.append((u, v))
            inc = min(inc, cap[u][v])
            v = u

        path.reverse()

        steps.append((path, inc))

        v = t

        while v != s:
            u = parent[v]

            cap[u][v] -= inc
            cap[v][u] += inc

            v = u

        max_flow += inc

    # calculate actual flows
    for e in edges:
        e.flow = cap[e.v][e.u]

    return max_flow, steps

# =========================================================
# UI
# =========================================================

buttons = [
    Button(30, 120, 180, 48, "Add Node"),
    Button(30, 185, 180, 48, "Add Edge"),
    Button(30, 250, 180, 48, "Run Algorithm", GREEN),
    Button(30, 315, 180, 48, "Reset", RED),
]

nodes = []
edges = []

mode = None

drag_node = None
edge_start = None

popup = None
pending_edge = None

max_flow = 0

animation_steps = []
current_step = 0

animating = False
animation_timer = 0

# =========================================================
# MAIN LOOP
# =========================================================

running = True

while running:

    dt = clock.tick(60) / 1000

    screen.fill(BG)

    # =====================================================
    # LEFT PANEL
    # =====================================================

    pygame.draw.rect(screen, PANEL, (0, 0, 250, HEIGHT))

    draw_text("Network Flow", FONT_TITLE, WHITE, (28, 30))
    draw_text("Ford-Fulkerson / Edmonds-Karp", FONT, SOFT, (32, 75))

    for b in buttons:
        b.draw()

    draw_text(f"Nodes : {len(nodes)}", FONT, WHITE, (30, 420))
    draw_text(f"Edges : {len(edges)}", FONT, WHITE, (30, 450))
    draw_text(f"Max Flow : {max_flow}", FONT_BIG, GREEN, (30, 510))

    draw_text("Source = Node 0", FONT_SMALL, MUTED, (30, 570))
    draw_text("Sink = Last Node", FONT_SMALL, MUTED, (30, 595))

    # =====================================================
    # EVENTS
    # =====================================================

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False

        if popup:
            result = popup.handle(event)

            if result == "ok" and popup.text:
                u, v = pending_edge
                edges.append(Edge(u, v, int(popup.text)))

                popup = None
                pending_edge = None

            elif result == "cancel":
                popup = None
                pending_edge = None

            continue

        if event.type == pygame.MOUSEBUTTONDOWN:

            pos = pygame.Vector2(event.pos)

            # buttons
            for b in buttons:

                if b.clicked(event.pos):

                    mode = b.text

                    if b.text == "Reset":
                        nodes.clear()
                        edges.clear()

                        max_flow = 0

                        animation_steps.clear()

                        animating = False

                    elif b.text == "Run Algorithm":

                        if len(nodes) >= 2:

                            max_flow, animation_steps = edmonds_karp_steps(
                                len(nodes),
                                edges,
                                0,
                                len(nodes) - 1
                            )

                            current_step = 0
                            animating = True
                            animation_timer = 0

            # nodes
            for n in nodes:

                if n.hit(pos):

                    if mode == "Add Edge":

                        if edge_start is None:
                            edge_start = n.id

                        else:
                            pending_edge = (edge_start, n.id)
                            popup = Popup("Enter Capacity")
                            edge_start = None

                    else:
                        drag_node = n

            # create node
            if mode == "Add Node" and pos.x > 270:
                nodes.append(Node(len(nodes), pos.x, pos.y))

        if event.type == pygame.MOUSEBUTTONUP:
            drag_node = None

        if event.type == pygame.MOUSEMOTION and drag_node:
            drag_node.pos = pygame.Vector2(event.pos)

    # =====================================================
    # ANIMATION SYSTEM
    # =====================================================

    if animating and current_step < len(animation_steps):

        animation_timer += dt

        # clear highlights
        for e in edges:
            e.highlight = False

        path, inc = animation_steps[current_step]

        for u, v in path:
            for e in edges:
                if e.u == u and e.v == v:
                    e.highlight = True

        if animation_timer > 1.2:
            current_step += 1
            animation_timer = 0

    else:
        for e in edges:
            e.highlight = False

    # =====================================================
    # DRAW GRAPH
    # =====================================================

    for e in edges:
        e.draw(nodes)

    for n in nodes:
        n.draw()

    # current augmenting path
    if animating and current_step < len(animation_steps):

        path, inc = animation_steps[current_step]

        info = " → ".join([str(u) for u, v in path] + [str(path[-1][1])])

        box = pygame.Rect(300, 25, 750, 60)

        pygame.draw.rect(screen, PANEL, box, border_radius=16)
        pygame.draw.rect(screen, CYAN, box, 2, border_radius=16)

        draw_text(
            f"Augmenting Path: {info}    |    Flow Added: {inc}",
            FONT_BIG,
            WHITE,
            (320, 43)
        )

    # popup
    if popup:
        popup.draw()

    pygame.display.flip()

pygame.quit()