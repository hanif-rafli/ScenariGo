class StoreList:

    def __init__(self, array):
        self.array = array

    def getList(self):
        return self.array
    
    def addStore(self):
        pass


class Store:
    def __init__(self,name,location,inventory,requests):
        self.name=name
        self.location=location
        self.inventory=inventory
        self.requests=requests 
    
    def getRequest(self):
        return self.requests
    
    def __str__(self):
        return(f"Name: {self.name},\n Location: {self.location},\n Inventory: {self.inventory},\n Requests: {self.requests}")
    

    

a = Store("Gramedia",0,[3,4,0,0,0,9],[7,6,10,10,10,1])
    
    
ls = StoreList(a)
ls.getList()
print(ls.getList())