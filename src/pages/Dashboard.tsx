import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ImagePlus, ArrowRight, Clock, Layers } from "lucide-react";

const recentImages = [
  { id: 1, name: "Product Hero Shot", time: "2 hours ago" },
  { id: 2, name: "Lifestyle Scene", time: "5 hours ago" },
  { id: 3, name: "Marketplace Thumbnail", time: "Yesterday" },
  { id: 4, name: "Social Ad", time: "2 days ago" },
];

const recentProducts = [
  { id: 1, name: "Premium Headphones", visuals: 12 },
  { id: 2, name: "Smart Watch Pro", visuals: 8 },
  { id: 3, name: "Wireless Earbuds", visuals: 15 },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export const Dashboard = () => {
  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto space-y-12"
      >
        {/* Header */}
        <motion.div variants={item} className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-lg">
            What would you like to create today?
          </p>
        </motion.div>

        {/* Primary CTAs */}
        <motion.div variants={item} className="grid md:grid-cols-2 gap-6">
          {/* Generate from Prompt */}
          <Link href="/generate?tab=prompt" className="group">
            <div className="card-interactive p-8 h-full bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">
                Generate from Prompt
              </h2>
              <p className="text-muted-foreground">
                Describe your idea and see it come to life. Perfect for exploring new concepts.
              </p>
            </div>
          </Link>

          {/* Enhance Product Photo */}
          <Link href="/generate?tab=product" className="group">
            <div className="card-interactive p-8 h-full bg-gradient-to-br from-accent/5 to-transparent">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <ImagePlus className="w-7 h-7 text-accent" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">
                Enhance Product Photo
              </h2>
              <p className="text-muted-foreground">
                Turn your product photo into premium visuals. Ideal for brands and sellers.
              </p>
            </div>
          </Link>
        </motion.div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Images */}
          <motion.div variants={item} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Recently Generated
              </h3>
              <Link href="/products" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {recentImages.map((image) => (
                <div
                  key={image.id}
                  className="card-interactive p-4 group cursor-pointer"
                >
                  <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{image.name}</p>
                  <p className="text-xs text-muted-foreground">{image.time}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Products */}
          <motion.div variants={item} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-muted-foreground" />
                Your Products
              </h3>
              <Link href="/products" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {recentProducts.map((product) => (
                <div
                  key={product.id}
                  className="card-interactive p-4 flex items-center gap-4 group cursor-pointer"
                >
                  <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-secondary to-muted group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.visuals} visuals</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: "24" },
            { label: "Images Generated", value: "156" },
            { label: "Templates Used", value: "18" },
            { label: "Ads Created", value: "12" },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated p-4 text-center">
              <p className="text-2xl font-display font-semibold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
