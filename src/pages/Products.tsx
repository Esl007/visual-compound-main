import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Grid3X3, 
  List, 
  MoreHorizontal,
  Image as ImageIcon,
  Tag,
  ArrowRight
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  visualCount: number;
  brand?: string;
  lastUpdated: string;
}

const products: Product[] = [
  { id: 1, name: "Premium Headphones", visualCount: 12, brand: "TechBrand", lastUpdated: "2 hours ago" },
  { id: 2, name: "Smart Watch Pro", visualCount: 8, brand: "TechBrand", lastUpdated: "5 hours ago" },
  { id: 3, name: "Wireless Earbuds", visualCount: 15, lastUpdated: "Yesterday" },
  { id: 4, name: "Laptop Stand", visualCount: 6, brand: "HomeOffice", lastUpdated: "2 days ago" },
  { id: 5, name: "USB-C Hub", visualCount: 4, brand: "TechBrand", lastUpdated: "3 days ago" },
  { id: 6, name: "Desk Organizer", visualCount: 9, brand: "HomeOffice", lastUpdated: "1 week ago" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export const Products = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
              Products
            </h1>
            <p className="text-muted-foreground">
              Manage your product visuals in one place
            </p>
          </div>
          <button className="btn-primary flex items-center gap-2 w-fit">
            <Plus className="w-5 h-5" />
            New Product
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid/List */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={viewMode === "grid" 
            ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "space-y-4"
          }
        >
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              variants={item}
              className="card-interactive group cursor-pointer"
            >
              {viewMode === "grid" ? (
                <div className="p-4">
                  {/* Thumbnail */}
                  <div className="aspect-square rounded-xl bg-muted mb-4 overflow-hidden relative">
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 via-secondary to-accent/10 group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{product.visualCount}</span>
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {product.brand && (
                          <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Tag className="w-3 h-3" />
                            {product.brand}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{product.lastUpdated}</span>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-muted flex-shrink-0 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        {product.visualCount} visuals
                      </span>
                      {product.brand && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          {product.brand}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <span className="text-sm text-muted-foreground hidden sm:block">{product.lastUpdated}</span>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your search</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Products;
