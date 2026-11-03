from collections import deque

# ===============================================================
# FIT2004 Assignment Q1 — assign()
# Network Flow + Dijkstra approach
# Supports lower and upper capacity bounds with exact total flow T.
# ===============================================================

class Vertex:
    """
    Function Description:
    Basic vertex  node used for adjacency lists in graph representations.
    
    Approach Description:
    Each vertex  stores destination vertex, edge information, and pointers
    for building Linked-node adjacency structures. Used for both flow networks
    and road graphs
    
    Input:
    - value: destination vertex index
    - item:  edge payload (weight, capacity, or flow data)
    
    Output:
    - Initialized Vertex node
    
    Time Complexity: O(1)
    Time Complexity Analysis: Simple attribute assignment
    
    Aux Space Complexity: O(1)  
    Aux Space Complexity Analysis: fixed number of attributes per node 
    """
    def __init__(self, value, item):
        self.vertex = value
        self.item = item
        self.next = None
        self.reverse_edge = None  #   For residual network pairing
        self.flow_edge = None   # reference to corresponding flow edge


class Graph:
    """
    Function Description:
    Graph implementation using adjacency lists with linked lists of Vertex nodes.
    
    Approach Description:
    Maintains an array of linked list heads, where each head points to
    the first edge originating from that vertex.
    
    Input:
    - V: number of vertices in the graph
    
    Output:
    - Empty graph with V vertices
    
    Time Complexity: O(V)
    Time Complexity Analysis: Initializing array of size V
    
    Aux Space Complexity: O(V)
    Aux Space Complexity Analysis: Array of V pointers, initially None
    """
    def __init__(self, V):
        self.v=V
        self.vertices = [None] *  V

    def add_edge(self, u, v,  item):
        """
        Function Description:
        Adds a directed edge  from u to v with given item payload.
        
        Input:
        - u: source vertex
        - v: destination vertex  
        - item: edge data (capacity, weight, etc.)
        
        Output:
        - Returns the newly created Vertex node
        
        Time Complexity: O(1)
        Time Complexity Analysis: Prepending to linked list is constanttime
        
        Aux Space Complexity: O(1)
        --> aux  Space Complexity Analysis: Creates one new Vertex node.
        """
        node = Vertex(v, item)
        node.next = self.vertices[u]  # Insert at head of linked list
        self.vertices[u] = node
        return node



class Network:
    """
    Function Description:
    Implements a residual network for max flow computation using Ford-Fulkerson
    method with BFS for finding augmenting paths.
    
    Approach Description :
    Maintains both flow and residual graphs. Each edge in the flow graph has
    corresponding forward and backward edges  in the residual graph to enable
    flow augmentation.
    """
    def __init__(self, size, edges, source,sink):
        """
        Function Description:
        Constructs flow and residual graphs from edge list.
        
        Approach Description:
        for each capacity edge (u,v,cap), creates:
        - Flow edge: tracks current flow and capacity
        - Residual forward edge: initially has capacity called cap  
        - Residual backward edge: initially has capacity 0
        Pairs residual edges for efficient updates during augmentation
        
        Input:
        - size:total number of vertices in flow network
        - edges: list of (u, v, capacity) tuples
        - source: source vertex index
        - sink: sink vertex index
        
        Output:
        - Initialized Network object ready for max flow computation
        
        Time Complexity: O(E) where E is number  of edges
        Time Complexity Analysis:
        Processes each input edge exactly once, creating  constant work per edge
        for flow graph and residual graph construction.
        
        Aux Space Complexity: O(V+E)
        Aux Space Complexity Analysis:
        Stores adjacency lists for V vertices with total O(E) edge nodes
        across both flow and residual graphs.
        """
        self.source = source
        self.sink= sink
        self.size = size
        self.flow = Graph(size)  #Ttracks actual flow values
        self.res =  Graph(size)    # Residual capacities for augmentation

        # Build both flow and residual graphs for each edge
        for u, v , cap in edges:
            # Add to flow graph with initial flow 0 and given capacity
            fwd = self.flow.add_edge(u, v, (0, cap))
            
            # create  residual edges
            f_edge = Vertex(v, (cap,  "f")) # Forward residual edge
            b_edge = Vertex(u, (0, "b"))     # Backward residual edge

         
            f_edge.reverse_edge = b_edge     # link residual edges for updates
            b_edge.reverse_edge = f_edge
            f_edge.flow_edge = fwd  # Reference to track flow updates
            b_edge.flow_edge = fwd

            
            f_edge.next = self.res.vertices[u] # add to residual graph adjacency lists
            self.res.vertices[u] = f_edge
            b_edge.next = self.res.vertices[v]
            self.res.vertices[v] = b_edge

    def maxflow(self):
        """
        Function Description:
        Computes maximum flow from  source to sink using BFS augmentation.
        
        Approach Description:
        Repeatedly finds augmenting paths  in the residual graph using BFS.
        For each path found,pushes the maximum possible flow (bottleneck)
        and updates residual capacities  accordingly
        
        Output:
        - Total flow value from source to sink
        
        time Complexity: O(V * E^2) in worst case
        Time Complexity Analysis:
        Each BFS takes O(V + E) time. In worst case, we may need O(E) 
        augmentations (each pushing at least 1 unit of flow), and each 
        augmentation updates O(V) edges along the path.
        
        Aux Space Complexity: O(V)
        Aux Space Complexity Analysis:
        BFS uses O(V) space for parent   tracking and queue.No additional
        structures scale with E during  the algorithm execution
        """
        s, t = self.source,self.sink
        total = 0
        
        #continue while augmenting paths exist
        while True:
            # BFS to find augmenting path
            q = deque([s])
            parent = [-1] * self.size     # Track path for flow augmentation
            edge_used = [None] * self.size    # Track which edge was used to reach each vertex
            parent[s] = s
            


            while q and parent[t] == -1:
                u = q.popleft()
                e = self.res.vertices[u]
                while e:
                    v = e.vertex
                    cap = e.item[0]
                    
                    if cap > 0 and parent[v] == -1: # explore if residual capacity > 0 and not visited
                        parent[v] = u
                        edge_used[v] = e
                        q.append(v)
                        if v == t:  # early exit if sink reached
                            break
                    e = e.next

        
            if parent[t] == -1:     # No augmenting path found
                break

            
            bottleneck = float('inf')  # find  bottleneck capacity along the path
            v = t 
            while v != s:
                e = edge_used[v]
                if e is None:  #safety check
                    bottleneck =   0
                    break
                bottleneck = min(bottleneck,e.item[0])  # mnimum residual capacity
                v = parent[v]

            if bottleneck ==  0 or bottleneck == float('inf'):
                break

            # Augment flow along the path
            v= t
            while v != s:
                e = edge_used[v]
                # update residual capacities
                e.item = (e.item[0] - bottleneck, e.item[1])  #decrease forward
                e.reverse_edge.item =(e.reverse_edge.item[0] + bottleneck, e.reverse_edge.item[1])  #  Increase backward
                
                # Update actual flow in flow graph
                f, c = e.flow_edge.item
                if e.item[1] == "f": #Forward edge in residual
                    e.flow_edge.item = (f + bottleneck, c)  # increase flow
                else:  #backwrawd
                    e.flow_edge.item = (f - bottleneck, c)  # Decrease flow
                v = parent[v]
                
            total += bottleneck
            
        return total


class MinHeap:
    """
    Function desc:
    Minimum priority heap implementation for Dijkstra's algorithm.
    
    Approach Description:
    Binary min-heap stored in 1-indexed array. Supports insert and extract-min
    operations with O(log n) time complexity
    """
    def __init__(self, n):
        """
        Function Description:
        Initializes empty heap with capacity for n elements
        
        Input:
           n: maximum number of elements heap can hold
        
        Time Complexity: O(n)
        Time Complexity Analysis: Allocating array of size n+1
        
        Aux Space Complexity: O(n)
        aux Space Complexity Analysis: Array of size n+1 stores heap elements
        """
        self.a = [None] *  (n+ 1)     #1-indexed array
        self.len =0

    def rise(self, k):
        """
        Function Description:
        Bubbles up element at  position k to maintain heap property.
        
        Time Complexity: O(log n)
        Time Complexity Analysis:At most log n comparisons/swaps
        
        Aux space Complexity: O(1)
        """
        x = self.a[k]
        while k >1 and x[0] < self.a[k // 2][0]:
            self.a[k] = self.a[k // 2]
            k //=2
        self.a[k]  = x

    def sink(self, k):
        """
        function Description:
         maintain heap property by sinking down .
        
        Time Complexity: O(log n)
        Time Complexity Analysis: At most log n comparisons/swasps
        
        Aux Space Complexity: O(1)
        """
        x = self.a[k]
        while 2 * k <= self.len:
            j = 2 * k
            if j < self.len and self.a[j +1][0] < self.a[j][0]:
                j += 1
            if self.a[j][0] >=  x[0]:
                break
            self.a[k] =self.a[j]
            k = j
        self.a[k] = x

    def insert(self, x):
        """
        Function description:
        Inserts new element into the heap.
        
        Time Complexity: O(log n)
        Time Complexity Analysis: Rise operation takes O(log n)
        
        Aux Space Complexity: O(1)
        """
        self.len +=  1
        self.a[self.len] =x
        self.rise(self.len)

    def serve(self):
        """
        function Description:
        Removes and returns minimum element from heap.
        
        Output:
        -Minimum element or None if heap is empty
        
        Time Complexity: O(log n)
        >  Time Complexity Analysis: Sink operation takes O(log n)
        
        Aux space Complexity: O(1)
        """
        if  self.len == 0:
            return None
        m= self.a[1]
        self.a[1] = self.a[self.len]
        self.len -= 1
        self.sink(1)
        return  m


class DGraph:
    """
    Function Description :
    Weighted directed graph for Dijkstra's shortest path algorithm.
    
    Approach Description:
    Uses adjacency lists with vertex obj nodes to represent the road network
    Supports bidirectional edges for undirected graph representation
    """
    def __init__(self, V):
        """
        Function Description:
        Initializes empty graph with V vertices.
        
        Input:
        - V: number of vertices in graph
        
        Time Complexity: O(V)
        Time Complexity Analysis: Initializing array of size V
        
        Aux Space Complexity: O(V)
        Aux Space Complexity Analysis: Array of V adjacency list heads
        """
        self.V = V
        self.head = [None] * V

    def add_edge(self, u, v, w):
        """
        function dsescription:
        Adds directed edge from u to v with weight w
        
        Input:
         u:  source vertex
          v:destination vertex
           w: edge weight
        
        Time Complexity: O(1)
        time Complexity Analysis: Prepending to linked list
        
        Aux Space Complexity: O(1)
        aux Space Complexity Analysis: One new Vertex node created
        """
        node = Vertex(v, w)
        node.next =self.head[u]
        self.head[u] = node

    def dijkstra(self, start, D_limit=None):
        """
        function Description:
        Computes shortest paths from start vertex using Dijkstra's algorithm.
        
        Approach Description:
        Uses min-heap to efficiently select next vertex to relax. Can optionally
        return only vertices within distance D_limit.
        
        Input:
        - start: source vertex index
        - D_limit: optional maximum distance cutoff
        
        Output:
        - If D_limit is None: list of shortest distances to all vertices
        - If D_limit provided: list of vertex indices within D_limit distance
        
        Time Complexity: O((V + E) log V)
        Time Complexity Analysis:
        Each vertex extracted once from heap (V log V), each edge relaxed once
        (E log V).Heap operations dominate.
        
        Aux Space Complexity: O(V)
        Aux Space complexity Analysis:
        Distance array (V), heap (V), and constant other variables.
        """
        dist = [float("inf")] *  self.V
        dist[start] = 0
        h = MinHeap(self.V)
        h.insert((0,start))
        
        # Main Dijkstra loop
        while h.len  >  0:
            d, u =  h.serve()
            if d > dist[u]:  # Skip if outdated heap entry
                continue
                
            # Relax all outgoing edges from u
            e = self.head[u]
            while e:
                v = e.vertex
                w = e.item
                nd =d+w
                if nd < dist[v]:  # Found shorter path to v
                    dist[v] = nd
                    h.insert((nd, v))
                e = e.next
                
        # Return appropriate result based on D_limit
        if D_limit is None:
            return dist
        # Filter vertices within distance limit
        reachable = []
        for i in range(self.V):
            if dist[i] <= D_limit:
                reachable.append(i)
        return reachable


# ---------------- Main assign() Function ----------------
def assign(L, roads, students, buses, D, T):
    """
    function Description:
    Determines feasible assignment of students to buses satisfying distance constraints,
    bus capacity bounds, and exact total student count requirement.
    
    Approach Description:
    1. Build road graph and compute reachable locations from each unique bus pickup point
    2. Construct flow network with lower/upper bounds to model constraints:
       - Source -> Students (capacity 1)
       -Students ---> Buses (if within distance D)  
       - Buses --> Sink (capacity max-min, lower bound min)
       - Sink ---> Source (lower bound T for exact total)
    3. Use circulation with super source/sink to handle lower bounds
    4. Extract assignment from flow solution
    
    Input:
    -L: number of locations (vertices in road graph)
    -roads: list of (u, v, w) bidirectional road segments
    -buses: list of (pickup_location, min_capacity, max_capacity)
    -students:  list of  locations for each student
     D: maximum distance students will travel to pickup points
    - T: exact number of students that must be assigned
    
    Output:
    - list where allocation[i] = bus index for student i, or -1 if not assigned
    - returns None if no feasible assignment exists
    
    Time Complexity: O(B * (L log L + L) + S * B * L + V * E^2)
    Time Complexity Analysis:
    - Road graph construction: O(R) where R = len(roads)
    - Dijkstra from each unique pickup: O(B_unique*(L log L + L)) where B_unique <=  18. though this makes it a constant
     - Student-bus edge creation: O(S * B * L) in worst case (nested loops with reachable check)
     - Flow network: O(V * E^2) where V = O(S + B), E = O(S * B)
    Dominated by student-bus edges and flow computation for large instances.
    
    Aux Space Complexity: O(L + S + B + R+E_flow)
    Aux Space Complexity Analysis:
    - Road graph: O(L + R) adjacency lists
    - Reachability arrays: O(B_unique * L)  
    - Flow network: O(V + E_flow) where V = O(S + B), E_flow = O(S * B)
    - various arrays: O(S + B + L) for demands, allocation, etc.
    """
    # build bidirectional road graph from input
    g = DGraph(L)
    for u, v, w in roads:
        g.add_edge(u, v, w)
        g.add_edge(v, u, w)  # Make undirected

  
    unique_pickups = []    # Identify unique bus pickup locations (at most 18)
    for i in range(len(buses)):
        p =  buses[i][0]
        found = False
        for x in unique_pickups:
            if x == p:
                found =  True
                break
        if not found:
            unique_pickups.append(p)

    
    reachable = [None] *  len(unique_pickups) # compute reachable  locations from each unique pickup within distance D
    for i in range(len(unique_pickups)):
        reachable[i] = g.dijkstra(unique_pickups[i], D)

 # Set up flow network indices and structures
    S = len(students)
    B = len(buses)
    src = 0
    stud_start =1  # Students at indices 1..S
    bus_start= 1 + S  # Buses at indices 1+ S ... 1+S+B-1  
    sink = 1 + S +B
    edges = []
    n_nodes = sink + 1
    demand = [0] *  n_nodes  # For circulation with lower bounds

    # Source --> Students edges (capacity 1 each)
    for s in range(S):
        edges.append((src, stud_start + s, 1))

    # student->Bus edges if student location is reachable from bus pickup
    for s in range(S):
        loc = students[s]
        for b in range(B):
            p_loc, minc, maxc = buses[b]
            # Find which unique pickup this bus uses
            for i in range(len(unique_pickups)):
                if unique_pickups[i] == p_loc:
                    
                    for k in range(len(reachable[i])): # check if student location is reachable from this pickup
                        if reachable[i][k] == loc:
                            edges.append((stud_start + s, bus_start + b, 1))
                            break
                    break

    # Bus --> Sink edges with capacity = max_cap - min_cap
     # Lower bound min_cap handled via demand array
    INF = 10**9  # big constant for unbounded edges
    total_lower = 0
    for b in range(B):
        _, min_cap, max_cap =  buses[b]
        if max_cap - min_cap < 0:  # invalid capacity range
            return None
        edges.append((bus_start + b, sink, max_cap - min_cap))
        demand[bus_start + b] -= min_cap  # bus requires min_cap inflow
        demand[sink] += min_cap    # Sink provides min_cap outflow
        total_lower+=min_cap

    #enforce exactly T total students: add sink->src edge with lower bound T
    edges.append((sink, src, INF - T))
    demand[sink] -= T  # Sink must send exactly T to source
    demand[src] +=  T   # Source must receive exactly T from sink

      # Convert to circulation problem with super source/sink
    super_src = n_nodes
    super_sink =n_nodes + 1
    sum_pos_demands = 0
    
    #add edges from super source to vertices with positive demand
        # and from vertices with negative demand to super sink
    for v in range(n_nodes):
        d = demand[v]
        if d > 0:
            edges.append((super_src, v, d))
            sum_pos_demands += d
        elif d < 0:
            edges.append((v, super_sink,  -d))

    # solve circulation: max flow from super source to super sink
    total_nodes = n_nodes + 2
    net = Network(total_nodes,edges, super_src, super_sink)
    f = net.maxflow()
    
    # Circulation exists iff flow saturates all super source edges
    if f  != sum_pos_demands:
        return None

    # Step 5: Extract student assignments from flow solution
    allocation =  [-1] * S
    assigned_count= 0
    for s in range(S):
        u=stud_start +  s
        e= net.flow.vertices[u]
        # Find which bus this student is assigned to (flow >0)
        while e:
            v = e.vertex
            if v >= bus_start and v < bus_start + B:  # Edge to a bus
                fval, cap = e.item
                if fval > 0:  # Flow indicates assignment
                    allocation[s] = v - bus_start
                    assigned_count += 1
                    break
            e = e.next

    # Sanity check: should have exactly T assignments
    if assigned_count !=T:
        return None
        
    return allocation


# ===============================================================
# SAMPLE TEST CASES (Assignment Brief and Additional Edge Cases)
# ===============================================================
if __name__ == "__main__":
    # ---------------- Case 1: Valid assignment (Assignment brief) ----------------
    roads = [
        (0,1,3), (0,2,5), (0,3,10),
        (1,4,1), (2,5,2), (5,6,3),
        (2,7,4), (0,8,1), (0,9,1),
        (0,10,1), (0,11,1), (6,12,2),
        (6,13,4), (6,14,3), (7,15,1)
    ]

    students = [
        4, 10, 8, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13,
        5, 7, 7, 7, 7, 7, 15, 15, 7, 4, 8, 9
    ]
    buses = [
        (0, 3, 5),
        (6, 5, 10),
        (15, 5, 10),
        (6, 5, 10)
    ]
    D = 5
    T = 22
    L = 16

    # print("----- Case 1: Valid assignment -----")
    # res = assign(L, roads, students, buses, D, T)
    # if res is None:
    #     print("No feasible assignment found.")
    # else:
    #     print("Student-to-bus allocation:", res)
    #     print("Assigned count:", sum(1 for x in res if x != -1))
    # print()

    # # ---------------- Case 2: Repeated test (same data) ----------------
    # print("----- Case 2: Repeated (should be same result) -----")
    # res = assign(L, roads, students, buses, D, T)
    # if res is None:
    #     print("No feasible assignment found.")
    # else:
    #     print("Student-to-bus allocation:", res)
    #     print("Assigned count:", sum(1 for x in res if x != -1))
    # print()

    # # ---------------- Case 3: Invalid capacity test ----------------
    # students = [5, 8, 3, 7, 7, 15, 15, 8, 15, 7, 6, 15]
    # buses = [(0, 3, 5), (15, 5, 6)]
    # D = 5
    # T = 7
    # L = 16

    # print("----- Case 3: Invalid (expected None) -----")
    # res = assign(L, roads, students, buses, D, T)
    # if res is None:
    #     print("No feasible assignment found.")
    # else:
    #     print("Student-to-bus allocation:", res)
    #     print("Assigned count:", sum(1 for x in res if x != -1))
    # print()

    # # ---------------- Case 4: Disjoint graph (two islands, two buses) ----------------
    # roads = [
    #     (0,1,2), (1,2,2), (2,3,40),   # island 1
    #     (4,5,1000), (5,6,1)           # island 2
    # ]
    # students = [
    #     0,0,
    #     1,1,
    #     3,3,3,
    #     4,4,4,4,
    #     5,5,5,5,5,5,5,5,5
    # ]
    # buses = [
    #     (0, 3, 10),
    #     (4, 3, 10)
    # ]
    # D = 2
    # T = 8
    # L = 7

    # print("----- Case 4: Disjoint graph (two islands) -----")
    # result = assign(L, roads, students, buses, D, T)
    # if result is None:
    #     print("No feasible assignment found.")
    # else:
    #     print("Student-to-bus allocation:", result)
    #     print("Assigned count:", sum(1 for x in result if x != -1))
    # print()

    # # ---------------- Case 5: No bus in one island ----------------
    # roads = [
    #     (0,1,2), (1,2,2), (2,3,40),   # island 1
    #     (4,5,1000), (5,6,1)           # island 2
    # ]
    # students = [
    #     0,0,
    #     1,1,
    #     3,3,3,
    #     4,4,4,4,
    #     5,5,5,5,5,5,5,5,5
    # ]
    # buses = [
    #     (0,3,10)
    # ]
    # D = 44
    # T = 7
    # L = 7

    # print("----- Case 5: No bus in second island (expected None) -----")
    # result = assign(L, roads, students, buses, D, T)
    # if result is None:
    #     print("No feasible assignment found.")
    # else:
    #     print("Student-to-bus allocation:", result)
    #     print("Assigned count:", sum(1 for x in result if x != -1))


