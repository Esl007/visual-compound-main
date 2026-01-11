import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutTemplate, Star, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  featured?: boolean;
  preview_url?: string;
  thumb_400_url?: string;
  thumb_600_url?: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 },
};

export const Templates = () => {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/templates");
        if (!res.ok) throw new Error("Failed to load templates");
        const j = await res.json();
        if (!aborted) setItems(Array.isArray(j?.items) ? j.items : []);
      } catch (e: any) {
        if (!aborted) setError("Could not load templates");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const categories = ["All", ...Array.from(new Set(items.map((t) => t.category)))];
  const filteredTemplates = activeCategory === "All" ? items : items.filter((t) => t.category === activeCategory);

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Templates
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose how your product is presented
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          key={activeCategory}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {filteredTemplates.map((template) => (
            <motion.div
              key={template.id}
              variants={item}
              onClick={() => setSelectedTemplate(template.id)}
              className={`card-interactive cursor-pointer relative overflow-hidden group ${
                selectedTemplate === template.id ? "ring-2 ring-primary" : ""
              }`}
            >
              {/* Preview */}
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {template.thumb_400_url || template.preview_url ? (
                  <>
                    <div className="absolute inset-0">
                      <div
                        className="w-full h-full bg-cover bg-center blur-sm"
                        style={{ backgroundImage: `url(${template.thumb_400_url || template.preview_url || ""})` }}
                      />
                    </div>
                    <img
                      src={template.thumb_400_url || template.preview_url || ""}
                      alt={template.title}
                      className="relative z-10 object-contain w-full h-full"
                    />
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/5 via-secondary to-accent/10" />
                )}
                
                {/* Popular Badge */}
                {template.featured && (
                  <div className="absolute top-3 left-3 bg-accent text-accent-foreground px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Popular
                  </div>
                )}

                {/* Selected Indicator */}
                {selectedTemplate === template.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button className="btn-primary text-sm px-4 py-2" onClick={(e) => { e.stopPropagation(); router.push(`/generate?templateId=${template.id}`); }}>
                      Use Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-foreground">{template.title}</h3>
                <p className="text-sm text-muted-foreground">{template.category}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-muted-foreground">
            Loading templates...
          </motion.div>
        ) : filteredTemplates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <LayoutTemplate className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No templates in this category</h3>
            <p className="text-muted-foreground">Check back soon for new templates</p>
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  );
};

export default Templates;
