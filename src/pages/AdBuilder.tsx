import { useState } from "react";
import { motion } from "framer-motion";
import { 
  PenTool, 
  Type, 
  Image as ImageIcon, 
  Palette, 
  Download, 
  RefreshCw,
  ChevronDown,
  Settings2
} from "lucide-react";

export const AdBuilder = () => {
  const [headline, setHeadline] = useState("Premium Sound, Redefined");
  const [cta, setCta] = useState("Shop Now");
  const [advancedMode, setAdvancedMode] = useState(false);

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
              Ad Builder
            </h1>
            <p className="text-muted-foreground">
              Create polished ad creatives in minutes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Settings2 className="w-4 h-4" />
              Advanced Mode
              <div
                onClick={() => setAdvancedMode(!advancedMode)}
                className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${
                  advancedMode ? "bg-primary" : "bg-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform duration-200 ${
                    advancedMode ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="card-elevated p-6">
              <div className="aspect-square bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-xl relative overflow-hidden">
                {/* Product Image Area */}
                <div className="absolute inset-8 flex items-center justify-center">
                  <div className="w-3/4 h-3/4 bg-muted rounded-2xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Select a product</p>
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <div className="absolute bottom-16 left-8 right-8">
                  <h2 
                    className="text-2xl md:text-3xl font-display font-bold text-foreground cursor-text"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setHeadline(e.currentTarget.textContent || headline)}
                  >
                    {headline}
                  </h2>
                </div>

                {/* CTA Button */}
                <div className="absolute bottom-6 left-8">
                  <div 
                    className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium cursor-text"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setCta(e.currentTarget.textContent || cta)}
                  >
                    {cta}
                  </div>
                </div>

                {/* Advanced Mode Overlay */}
                {advancedMode && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    <div className="absolute top-0 left-0 right-0 h-16 border-b-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="text-xs text-primary bg-card px-2">Header Zone</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-24 border-t-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="text-xs text-primary bg-card px-2">CTA Zone</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Selection */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                Product
              </h3>
              <button className="w-full flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <span className="text-muted-foreground">Select a product...</span>
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Text Controls */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Type className="w-5 h-5 text-muted-foreground" />
                Text
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Headline</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Call to Action</label>
                  <input
                    type="text"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
              <button className="w-full btn-secondary flex items-center justify-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" />
                Auto-generate Copy
              </button>
            </div>

            {/* Style Controls */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Palette className="w-5 h-5 text-muted-foreground" />
                Style
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {["#2dd4bf", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6", "#10b981", "#f97316", "#6366f1"].map((color) => (
                  <button
                    key={color}
                    className="aspect-square rounded-lg border-2 border-border hover:border-foreground transition-colors"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Export */}
            <button className="w-full btn-primary flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Export Ad
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdBuilder;
