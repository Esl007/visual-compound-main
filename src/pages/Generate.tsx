"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ImagePlus,
  Upload,
  Wand2,
  ArrowRight,
  RefreshCw,
  Save,
  Layers,
  LayoutTemplate,
  Check,
} from "lucide-react";

const tabs = [
  { id: "prompt", label: "From Prompt", icon: <Sparkles className="w-4 h-4" /> },
  { id: "product", label: "From Product Photo", icon: <ImagePlus className="w-4 h-4" /> },
];

export const Generate = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState((searchParams?.get("tab") as string | null) || "prompt");
  const [prompt, setPrompt] = useState("");
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(false);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultUploadedUrl, setResultUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [keepBackground, setKeepBackground] = useState(true);
  const [sceneDescription, setSceneDescription] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [apiError, setApiError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab && (tab === "prompt" || tab === "product")) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", tabId);
    router.replace(`${pathname}?${params.toString()}`);
    setGeneratedImage(false);
  };

  const requestPresign = async (file: File) => {
    const res = await fetch("/api/storage/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: file.type, fileName: file.name }),
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    return (await res.json()) as { uploadUrl: string; fileUrl: string };
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      // Capture data URL for server-side generation (avoid remote fetch issues)
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      setUploadedImageDataUrl(dataUrl);
      const { uploadUrl, fileUrl } = await requestPresign(file);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      setUploadedImageUrl(fileUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setApiError(null);
    setDebugInfo(null);
    try {
      if (activeTab === "prompt") {
        // Optionally enhance prompt via Google AI route
        if (enhancePrompt && prompt.trim()) {
          const r = await fetch("/api/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
          });
          if (r.ok) {
            const j = await r.json();
            if (j?.text) setPrompt(j.text);
          }
        }
      } else if (activeTab === "product") {
        // Ensure an image is uploaded; optionally generate caption via Google API
        if (!uploadedImageUrl) {
          setIsGenerating(false);
          return;
        }
        if (sceneDescription.trim()) {
          const r = await fetch("/api/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: sceneDescription }),
          });
          if (r.ok) {
            const j = await r.json();
            if (j?.text) setSceneDescription(j.text);
          }
        }
      }

      // Generate image via API
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: activeTab === "prompt" ? prompt : sceneDescription || prompt,
          productImageUrl: activeTab === "product" ? uploadedImageUrl : undefined,
          productImageDataUrl: activeTab === "product" ? uploadedImageDataUrl : undefined,
          keepBackground,
          aspectRatio,
        }),
      });
      if (!genRes.ok) {
        const errText = await genRes.text();
        setApiError(errText);
        setIsGenerating(false);
        return;
      }
      const gen = await genRes.json();
      if (gen?.debug) setDebugInfo(gen.debug);
      const mimeType: string = gen?.mimeType || "image/png";
      const b64: string | undefined = gen?.imageBase64;
      if (!b64) throw new Error("No image data returned");
      const dataUrl = `data:${mimeType};base64,${b64}`;
      setResultDataUrl(dataUrl);
      setGeneratedImage(true);
      // Scroll generated output into view
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);

      // Upload generated image to storage
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `generated-${Date.now()}.png`, { type: mimeType });
      const { uploadUrl, fileUrl } = await requestPresign(file);
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": mimeType }, body: file });
      if (!put.ok) throw new Error("Failed to upload generated image");
      setResultUploadedUrl(fileUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Generate
          </h1>
          <p className="text-muted-foreground text-lg">
            Create stunning product visuals in seconds
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-secondary rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="card-elevated p-6 space-y-6"
          >
            <AnimatePresence mode="wait">
              {activeTab === "prompt" ? (
                <motion.div
                  key="prompt-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Prompt Input */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Describe your vision
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="A premium wireless headphone on a marble surface with soft morning light, minimalist aesthetic..."
                      className="input-field min-h-[140px] resize-none"
                    />
                  </div>

                  {/* Enhance Toggle */}
                  <label className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Wand2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Enhance prompt with AI</p>
                        <p className="text-xs text-muted-foreground">Let AI refine your description</p>
                      </div>
                    </div>
                    <div
                      onClick={() => setEnhancePrompt(!enhancePrompt)}
                      className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
                        enhancePrompt ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-card shadow transition-transform duration-200 ${
                          enhancePrompt ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </div>
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="product-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Upload Area */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Upload your product photo
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) void handleFileSelected(f);
                      }}
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer group"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-foreground font-medium mb-1">
                        {uploading ? "Uploading..." : uploadedImageUrl ? "Image selected" : "Drop your image here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleFileSelected(e.target.files?.[0] || undefined)}
                      />
                    </div>

                    {uploadedImageUrl && (
                      <div className="mt-3">
                        <img src={uploadedImageUrl} alt="Uploaded" className="rounded-lg max-h-48 mx-auto" />
                      </div>
                    )}
                  </div>

                  {/* Scene Description */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Scene description (optional)
                    </label>
                    <input
                      type="text"
                      value={sceneDescription}
                      onChange={(e) => setSceneDescription(e.target.value)}
                      placeholder="e.g., On a wooden desk with plants"
                      className="input-field"
                    />
                  </div>

                  {/* Keep Background Toggle */}
                  <label className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Keep background consistent</p>
                        <p className="text-xs text-muted-foreground">Maintain visual consistency</p>
                      </div>
                    </div>
                    <div
                      onClick={() => setKeepBackground(!keepBackground)}
                      className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
                        keepBackground ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-card shadow transition-transform duration-200 ${
                          keepBackground ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </div>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aspect Ratio */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Aspect ratio</label>
              <div className="flex items-center gap-2">
                {(["1:1", "16:9", "9:16"] as const).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                      aspectRatio === ar ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Visual
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>

          {/* Output Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="card-elevated p-6 flex flex-col"
            ref={outputRef}
          >
            {apiError && (
              <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm break-words">
                {apiError}
              </div>
            )}
            <div className="flex-1 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {generatedImage ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full space-y-4"
                  >
                    {/* Generated Image */}
                    <div className="rounded-xl overflow-hidden bg-muted flex items-center justify-center w-full h-[420px]">
                      {resultUploadedUrl || resultDataUrl ? (
                        <img
                          src={resultUploadedUrl || resultDataUrl || ""}
                          alt="Generated"
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <div className="text-center p-8">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
                            <Check className="w-10 h-10 text-primary" />
                          </div>
                          <p className="text-foreground font-medium">Image Generated!</p>
                          <p className="text-sm text-muted-foreground">Your visual is ready</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-3">
                      <button className="btn-secondary flex flex-col items-center gap-1 py-3">
                        <Save className="w-5 h-5" />
                        <span className="text-xs">Save as Product</span>
                      </button>
                      <button className="btn-secondary flex flex-col items-center gap-1 py-3">
                        <RefreshCw className="w-5 h-5" />
                        <span className="text-xs">Variations</span>
                      </button>
                      <button className="btn-secondary flex flex-col items-center gap-1 py-3">
                        <LayoutTemplate className="w-5 h-5" />
                        <span className="text-xs">Apply Template</span>
                      </button>
                    </div>

                    {/* Debug: What was sent and what was received */}
                    {debugInfo && (
                      <div className="mt-2 p-3 rounded-md border border-border bg-muted/40 text-xs text-foreground space-y-2">
                        <div className="font-medium">What was sent to Google</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-muted-foreground">Endpoint:</span> {debugInfo.endpoint || "-"}</div>
                          <div><span className="text-muted-foreground">Model:</span> {debugInfo.request?.model || "-"}</div>
                          <div><span className="text-muted-foreground">Aspect:</span> {debugInfo.request?.aspect || "-"}</div>
                          <div><span className="text-muted-foreground">Inline image:</span> {String(Boolean(debugInfo.request?.hasInlineImage))}</div>
                          <div className="col-span-2 break-words"><span className="text-muted-foreground">Prompt preview:</span> {debugInfo.request?.promptPreview || "-"}</div>
                        </div>
                        <div className="font-medium mt-2">What was received</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-muted-foreground">imagesCount:</span> {debugInfo.response?.imagesCount ?? "-"}</div>
                          <div><span className="text-muted-foreground">candidatesCount:</span> {debugInfo.response?.candidatesCount ?? "-"}</div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center p-8"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium mb-1">Your visual will appear here</p>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "prompt" 
                        ? "Enter a prompt to get started" 
                        : "Upload a product photo to begin"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Generate;
