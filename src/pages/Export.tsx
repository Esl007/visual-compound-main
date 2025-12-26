import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Download, 
  Share2, 
  Image as ImageIcon, 
  FileImage,
  Instagram,
  Facebook,
  ExternalLink,
  Check
} from "lucide-react";

const formats = [
  { id: "png", label: "PNG", description: "Best for web" },
  { id: "jpg", label: "JPG", description: "Smaller file size" },
  { id: "webp", label: "WebP", description: "Modern format" },
];

const sizes = [
  { id: "original", label: "Original", dimensions: "1024 × 1024" },
  { id: "instagram", label: "Instagram", dimensions: "1080 × 1080" },
  { id: "facebook", label: "Facebook", dimensions: "1200 × 628" },
  { id: "story", label: "Story", dimensions: "1080 × 1920" },
];

export const Export = () => {
  const [selectedFormat, setSelectedFormat] = useState("png");
  const [selectedSize, setSelectedSize] = useState("original");

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Export & Publish
          </h1>
          <p className="text-muted-foreground text-lg">
            Download and share your visuals
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="card-elevated p-6">
            <div className="aspect-square bg-muted rounded-xl overflow-hidden mb-4">
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary to-accent/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-card flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Select an image to export</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">No image selected</p>
          </div>

          {/* Options */}
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <FileImage className="w-5 h-5 text-muted-foreground" />
                Format
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {formats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                      selectedFormat === format.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-medium text-foreground">{format.label}</p>
                    <p className="text-xs text-muted-foreground">{format.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                Size
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {sizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all duration-200 flex items-center justify-between ${
                      selectedSize === size.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{size.label}</p>
                      <p className="text-xs text-muted-foreground">{size.dimensions}</p>
                    </div>
                    {selectedSize === size.id && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <button className="w-full btn-primary flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Download Image
            </button>

            {/* Social Publish */}
            <div className="card-elevated p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Share2 className="w-5 h-5 text-muted-foreground" />
                Publish to Social
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary flex items-center justify-center gap-2">
                  <Instagram className="w-5 h-5" />
                  Instagram
                </button>
                <button className="btn-secondary flex items-center justify-center gap-2">
                  <Facebook className="w-5 h-5" />
                  Facebook
                </button>
              </div>
              <button className="w-full btn-ghost flex items-center justify-center gap-2 border border-border">
                <ExternalLink className="w-4 h-4" />
                More platforms
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Export;
