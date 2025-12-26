import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Palette, 
  Upload, 
  Type, 
  Sparkles, 
  Check,
  Info
} from "lucide-react";

const stylePresets = [
  { id: "minimal", label: "Minimal", description: "Clean and simple" },
  { id: "bold", label: "Bold", description: "Strong and impactful" },
  { id: "luxury", label: "Luxury", description: "Elegant and premium" },
  { id: "playful", label: "Playful", description: "Fun and vibrant" },
];

export const BrandSettings = () => {
  const [brandName, setBrandName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("minimal");
  const [primaryColor, setPrimaryColor] = useState("#2dd4bf");
  const [accentColor, setAccentColor] = useState("#f59e0b");

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Brand Settings
          </h1>
          <p className="text-muted-foreground text-lg">
            Set rules once, benefit everywhere
          </p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Your visuals will automatically follow this style. Brand settings are optional — you can always generate without them.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-8">
          {/* Brand Name */}
          <div className="card-elevated p-6 space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Type className="w-5 h-5 text-muted-foreground" />
              Brand Identity
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Your brand name"
                  className="input-field"
                />
              </div>
              
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Logo</label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Drop your logo here or click to browse
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="card-elevated p-6 space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Palette className="w-5 h-5 text-muted-foreground" />
              Colors
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Style Preference */}
          <div className="card-elevated p-6 space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-muted-foreground" />
              Style Preference
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {stylePresets.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    selectedStyle === style.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{style.label}</p>
                      <p className="text-sm text-muted-foreground">{style.description}</p>
                    </div>
                    {selectedStyle === style.id && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button className="w-full btn-primary">
            Save Brand Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BrandSettings;
