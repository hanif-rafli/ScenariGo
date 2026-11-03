from datetime import datetime

# location -> destination(distance, travel_type)

# Location edges
# 0 -> 5(120,0)
# 1 -> 3(60,0)
# 2 -> 1(70,0)
# 3 -> 2(10,0) -> 12(16,0)
# 4 ->3 (30,0)-> 12 (10,0) -> 6(16,0)
# 5 -> 4(45,0) -> 7 (180,1)
# 6 -> 0 (300, 0)
# 7 -> 5(180,1)
# 8 -> 7(40,0)
# 9 -> 11(30,0) -> 8 (95,0) -> 7(80,0)  
# 10 -> 9(45,0)
# 11 -> 8(100,0)
# 12 -> 13(50,0) -> 6(16,0)
# 13 -> 2(30,0)


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
    
    def __str__(self):
        out = []
        for i in range(self.v):
            s = f"{i}:"
            n = self.vertices[i]
            while n:
                s += f" -> {n.vertex}{n.item}"
                n = n.next
            out.append(s)
        return "\n".join(out)


# stores
class Store: 

    def __init__(self, store_id,name, requests= [0,0,0]):
        self.store_id= store_id
        self.name = name
        self.requests= requests

    
    def __str__(self):
        return "\n" + "Store ID: " +str(self.store_id) +"\n" + "Store Name: " +str(self.name) + "\n" "Request List(raw): " +str(self.requests) + "\n"



def global_feasibility(inventory_global, store_requests):
    '''
    checks if the combined inventories from all warehouses of each product can satisfy the combined requests of all stores.
    The main idea is to check if there is a possiblity of an early termination.  

    report inventories and requests
    '''
    banner = "=================================="
    globally_feasible=[]
    infeasible_requests= []
    feasible = True




    global_store_request = [0] * num_products


    print("\n")
    print(banner)
    print(f"FEASIBILITY REPORT - {datetime.now()}")
    print(banner)
    for store in store_requests:   # for every store in the list of stores     
        # print(store)
        for product in range (len(store.requests)):  # for every item in the store's requests
            # print(request[product])
            prod = store.requests[product][0]  #product requested
            qty = store.requests[product][1]  # quantity
      
            if global_store_request[prod] + qty <= inventory_global[prod]:   # if we add to a prouct's global request and it is less or equal than inventory 
                                                                            # we can still add it and it is still feasible
                global_store_request[prod] += qty
                if store not in globally_feasible:
                    globally_feasible.append(store)

            elif global_store_request[prod] + qty > inventory_global[prod]:        #if not, we still add to keep track. set feasible to False.
                global_store_request[prod] += qty                               # 
                surplus = global_store_request[prod] - global_inventory[prod]
                
                feasible = False

                if store not in infeasible_requests:
                    infeasible_requests.append((store,prod,surplus))
    
    if not feasible:                                                            # print report accordingly
        for infeasible in infeasible_requests:
            print(f"\nstoreID_{infeasible[0].store_id} ({infeasible[0].name})'s request for productID_{infeasible[1]} is not feasible:"
                    f"\nProduct accumulated request: {global_store_request[infeasible[1]]}"
                    f"\nCurrent inventory: {global_inventory[infeasible[1]]}"
                    )
                
        for x in range( len(global_store_request)):
            
            final_sum = global_store_request[x] - global_inventory[x]

            if final_sum > 0:  #more requests than inventory
                print(
                    f"\nProduct {x} deficit: {final_sum} [Not Feasible]"
                )
            elif final_sum < 0: #more stored in inventory than requests
                print(
                        f"\nProduct {x} surplus: {abs(final_sum)} "
                    )
            else:   
                print(
                        f"\nProduct {x} : {abs(final_sum)}  "
                    )

        return False

        
    else:
        
        print("\n")
        for glob_req in range (len(global_store_request)):
            print(f"ProductID_{glob_req} globally requested: {global_store_request[glob_req]} units. (available global inventory: {global_inventory[glob_req]})")
        print("\n")
        print(f"STORE PRODUCT REQUESTS SUMMARY:")
        for store in store_requests:   # REPORT generation
            print(store.name)
            for req in range (len(store.requests)):
                id = store.requests[req][0]
                qty_requested =  store.requests[req][1]
                print(f"productID_{id} : {qty_requested} units")
            print("\n")
            
        return True

     


# initializing stores and products
NUM_stores= 2
num_products = 3
num_warehouses = 2



store1 = Store(0,"West Store",[(0,10),(1,5)])
store2 = Store(1,"Eastern Store",[(2,10),(0,10)])
store_product_requests = [store1, store2]


products= [None ]* num_products



# what each warehouse stores: (product, quantity)
# ie. warehouse 0 stores 21 of product 0 and 43 of product 3. 
warehouse_inventory=[[(0,5),(1,5)],[(0,1),(2,10)]]
global_inventory = [0 for i in range(num_products)]
for inventory in warehouse_inventory:
    for product in range( len(inventory)):
        pid= inventory[product][0]
        qty = inventory[product][1]
        global_inventory[pid] += qty




# travel type
travel_type = [0,1] # 0 is land, 1 is air or water.
graph = Graph(5)  
# (u, v, item) and item = (distance,travel type)
graph.add_edge(0,1,(5,0))
graph.add_edge(1,0,(5,0))
graph.add_edge(1,2,(10,0))
graph.add_edge(2,0,(25,0))
graph.add_edge(2,3,(30,1))
graph.add_edge(3,2,(30,1))
graph.add_edge(3,4,(25,0))
graph.add_edge(4,3,(25,0))


store_locations = [1,4] #store 0 is located at location 4
# port locations (air/water)
port_locations = [2,3]
#warehouse locations
warehouse_locations = [0,3] # warehouse 0 is located at location 0. warehouse 1 is located at location 3



print(graph)
print(global_feasibility(global_inventory,store_product_requests))




