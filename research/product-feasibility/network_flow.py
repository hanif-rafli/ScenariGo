from collections import deque
# This is adjacency list
class Graph:
    def __init__(self, V):
        # array
        self.v = V    
        self.vertices = [None] * V   # O(V) space
        
    def add_edge(self, source, target, item):
        node = Vertex(target, item)
        node.next = self.vertices[source]
        self.vertices[source] = node

    def __str__(self):
        result = ""
        for i in range(self.v):
            result += f"List of vertex {i}\n"
            temp = self.vertices[i]
            while temp:
                result += f" -->{temp.vertex}, {temp.item}"
                temp = temp.next
            result += "\n"
        return result

class Vertex:
    def __init__(self, value, item):
        self.vertex = value
        self.item = item
        self.next = None
        self.discovered = False
        self.visited = False

    def __str__(self):
        return f"{self.vertex}({self.item})"


from collections import deque
class network():
    '''
    - builds network and residual graph

    *note im using a linked list implementation, using vertex.next to iterate through the edges.
    - add_edge links the vertices
    '''
    def __init__(self,network_size,  graph_with_capacity ,source , sink): # input "graph_with_capacity" look like : [(0,1,13),....]
        self.network_graph = Graph(network_size)
        self.residual_graph = Graph(network_size)
        self.graph_with_capacity=graph_with_capacity
        self.network_size = network_size 
        self.source = source
        self.sink = sink

        # build  floww network 
        for edge in graph_with_capacity:   
            source =edge[0]
            target =edge[1]
            capacity =  edge[2]
            self.network_graph.add_edge(source,target, (0,capacity)) 

        ### bulding the residual graph based on the created network flow graph
        for u in range(self.network_size): 
            edge = self.network_graph.vertices[u]   
            while edge:                          
                self.residual_graph.add_edge(u, edge.vertex,(edge.item[1]-edge.item[0],"forward"))
                self.residual_graph.add_edge(edge.vertex,u ,(edge.item[0],"backward"))
                edge = edge.next

    def ford_fulkerson(self, flownetwork, resnetwork):
        '''
        - returns max flow
        - update flow edges in the network graph 
        '''
        maxflow = 0
        self.flow_network = flownetwork
        self.res_network = resnetwork

        while True:
            # ### find augmenting path 
            parent = [None] *self.network_size   # to reconstruct path
            edge_used = [None] * self.network_size  # store edge object used to reach vertex
            discovered = deque([self.source])
            visited = [False] * self.network_size
            visited[self.source] = True

            found_path = False
            while discovered:
                u = discovered.popleft()
                edge = self.res_network.vertices[u] # explore residual grah adj list
                while edge:
                    v = edge.vertex
                    residual_cap = edge.item[0]
                    if not visited[v] and residual_cap > 0:
                        visited[v] = True
                        parent[v] = u           #remember how we got here 
                        edge_used[v] = edge         # rember which edges we taken
                        discovered.append(v)
                        if v == self.sink:
                            found_path = True
                            break
                    edge = edge.next
                if found_path:
                    break

            if not found_path:
                break  # no augmenting path left

            #### find bottleneck capacity 
            v = self.sink
            bottleneck = float("inf")
            while v != self.source:
                edge = edge_used[v]
                bottleneck = min(bottleneck, edge.item[0])
                v = parent[v]

            ##### UPDATE residual and UPDATE flow network 
            v = self.sink
            while v != self.source:
                u = parent[v]
                edge = edge_used[v]

                if edge.item[1] == "forward":    # for forward edge
                    
                    edge.item = (edge.item[0] - bottleneck, "forward") # decrease forward residual
                    
                    back_edge = self.res_network.vertices[v] # increase backward residual
                    while back_edge and back_edge.vertex != u:
                        back_edge = back_edge.next
                    if back_edge:
                        back_edge.item = (back_edge.item[0] + bottleneck, "backward")

                    # update FLOW network 
                    flow_edge = self.flow_network.vertices[u]
                    while flow_edge and flow_edge.vertex != v:
                        flow_edge = flow_edge.next
                    if flow_edge:
                        f, c = flow_edge.item
                        flow_edge.item = (f + bottleneck, c)        # adding flow to the flow network

                else:  # backward edge
                    edge.item = (edge.item[0] - bottleneck, "backward")
                    
                    fwd_edge = self.res_network.vertices[v]
                    while fwd_edge and fwd_edge.vertex != u:
                        fwd_edge = fwd_edge.next
                    if fwd_edge:
                        fwd_edge.item = (fwd_edge.item[0] + bottleneck, "forward")

                # update flow
                    flow_edge = self.flow_network.vertices[v]
                    while flow_edge and flow_edge.vertex != u:
                        flow_edge = flow_edge.next
                    if flow_edge:
                        f, c = flow_edge.item
                        flow_edge.item = (f - bottleneck, c)   #(backward edge: subtract flow)

                v = parent[v]

            maxflow += bottleneck

        return maxflow
def inflow(flow_network, v):
    inflow_edges = []
    for u in range(flow_network.v):
        edge = flow_network.vertices[u]
        while edge:
            if edge.vertex == v:
                inflow_edges.append((u, edge.item))  # (from, (flow, cap))
            edge = edge.next
    return inflow_edges








if __name__ == "__main__":


    # IGNORE THIS: my_net = network(6,[(0, 1, 16),(0, 2, 13),(1, 2, 10),(2, 1, 4),(1, 3, 12), (2, 4, 14),(3, 2, 9),(4, 3, 7),(3, 5, 20),(4, 5, 4)],0,5)

    #USE THIS EXAMPLE:
    my_net = network(11,[(0,1,5),
                         (0,2,5),
                         (0,3,10),
                         (0,4,10),
                         (0,5,2),

                         (1,6,5),
                         (1,9,5),

                         (2,7,5),
                         
                         (3,8,5),
                         
                         (4,6,10),
                         (4,9,10),
                         
                         (6,10,10),
                         (7,10,5),
                         (8,10,5),
                         (9,10,5)],0,10)
    print(my_net)
    print("flow network: ")
    print(my_net.network_graph)
    print("residual network: ")
    print(my_net.residual_graph)


    print("Max flow: "+str(my_net.ford_fulkerson(my_net.network_graph,my_net.residual_graph)))
    print("updated flow network: ")

    print(my_net.network_graph)
    
    print(inflow(my_net.network_graph, 6)) # breaks down where the flow came from at vertex 6 




 
    







