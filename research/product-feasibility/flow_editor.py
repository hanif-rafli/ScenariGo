import pygame
from collections import deque

pygame.init()
WIDTH, HEIGHT = 1000, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Flow Graph Editor")
clock = pygame.time.Clock()

FONT = pygame.font.SysFont(None, 20)
BIGFONT = pygame.font.SysFont(None, 26)

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (220, 220, 220)
BLUE = (70, 130, 180)
GREEN = (0, 160, 0)
RED = (200, 50, 50)

# ---------- UI ----------
class Button:
    def __init__(self, x, y, w, h, text):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text

    def draw(self):
        pygame.draw.rect(screen, GRAY, self.rect)
        pygame.draw.rect(screen, BLACK, self.rect, 2)
        t = FONT.render(self.text, True, BLACK)
        screen.blit(t, t.get_rect(center=self.rect.center))

    def clicked(self, pos):
        return self.rect.collidepoint(pos)

class Popup:
    def __init__(self, prompt):
        self.prompt = prompt
        self.text = ""
        self.box = pygame.Rect(350, 200, 300, 160)
        self.input = pygame.Rect(370, 260, 260, 30)
        self.ok = pygame.Rect(380, 310, 100, 30)
        self.cancel = pygame.Rect(520, 310, 100, 30)

    def draw(self):
        pygame.draw.rect(screen, WHITE, self.box)
        pygame.draw.rect(screen, BLACK, self.box, 2)
        screen.blit(BIGFONT.render(self.prompt, True, BLACK), (370, 220))

        pygame.draw.rect(screen, WHITE, self.input)
        pygame.draw.rect(screen, BLACK, self.input, 2)
        screen.blit(FONT.render(self.text, True, BLACK), (375, 265))

        pygame.draw.rect(screen, GRAY, self.ok)
        pygame.draw.rect(screen, BLACK, self.ok, 2)
        screen.blit(FONT.render("OK", True, BLACK), self.ok.move(35, 6))

        pygame.draw.rect(screen, GRAY, self.cancel)
        pygame.draw.rect(screen, BLACK, self.cancel, 2)
        screen.blit(FONT.render("Cancel", True, BLACK), self.cancel.move(15, 6))

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

# ---------- GRAPH ----------
class Node:
    R = 20
    def __init__(self, i, x, y):
        self.id = i
        self.pos = pygame.Vector2(x, y)

    def draw(self):
        pygame.draw.circle(screen, BLUE, self.pos, self.R)
        pygame.draw.circle(screen, BLACK, self.pos, self.R, 2)
        txt = FONT.render(str(self.id), True, WHITE)
        screen.blit(txt, txt.get_rect(center=self.pos))

    def hit(self, pos):
        return self.pos.distance_to(pos) <= self.R

class Edge:
    def __init__(self, u, v, cap):
        self.u, self.v = u, v
        self.cap = cap
        self.flow = 0

    def draw(self, nodes):
        a = nodes[self.u].pos
        b = nodes[self.v].pos
        pygame.draw.line(screen, BLACK, a, b, 2)

        mid = (a + b) / 2
        label = FONT.render(f"{self.flow}/{self.cap}", True, RED)
        screen.blit(label, label.get_rect(center=mid))

# ---------- MAX FLOW ----------
def edmonds_karp(n, edges, s, t):
    cap = [[0]*n for _ in range(n)]
    for e in edges:
        cap[e.u][e.v] += e.cap

    flow = 0
    while True:
        parent = [-1]*n
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

        inc = float("inf")
        v = t
        while v != s:
            u = parent[v]
            inc = min(inc, cap[u][v])
            v = u

        v = t
        while v != s:
            u = parent[v]
            cap[u][v] -= inc
            cap[v][u] += inc
            v = u

        flow += inc

    return flow

# ---------- SETUP ----------
buttons = [
    Button(10, 10, 120, 30, "Add Node"),
    Button(10, 50, 120, 30, "Add Edge"),
    Button(10, 90, 120, 30, "Run Max Flow"),
    Button(10, 130, 120, 30, "Reset"),
]

nodes = []
edges = []
mode = None
drag = None
edge_start = None
popup = None
pending_edge = None

# ---------- LOOP ----------
running = True
while running:
    screen.fill(WHITE)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        if popup:
            r = popup.handle(event)
            if r == "ok" and popup.text:
                u, v = pending_edge
                edges.append(Edge(u, v, int(popup.text)))
                popup = None
            elif r == "cancel":
                popup = None
            continue

        if event.type == pygame.MOUSEBUTTONDOWN:
            pos = pygame.Vector2(event.pos)

            for b in buttons:
                if b.clicked(event.pos):
                    mode = b.text
                    if mode == "Reset":
                        nodes.clear()
                        edges.clear()
                        mode = None
                    if mode == "Run Max Flow" and len(nodes) >= 2:
                        maxf = edmonds_karp(len(nodes), edges, 0, len(nodes)-1)
                        print("Max flow:", maxf)
                        mode = None

            for n in nodes:
                if n.hit(pos):
                    if mode == "Add Edge":
                        if edge_start is None:
                            edge_start = n.id
                        else:
                            pending_edge = (edge_start, n.id)
                            popup = Popup("Capacity:")
                            edge_start = None
                    else:
                        drag = n

            if mode == "Add Node" and pos.x > 150:
                nodes.append(Node(len(nodes), pos.x, pos.y))

        if event.type == pygame.MOUSEBUTTONUP:
            drag = None

        if event.type == pygame.MOUSEMOTION and drag:
            drag.pos = pygame.Vector2(event.pos)

    for e in edges:
        e.draw(nodes)
    for n in nodes:
        n.draw()
    for b in buttons:
        b.draw()

    if popup:
        popup.draw()

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
