import DashboardUI from "@/ui/lovable/components/DashboardUI";

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
  const links = {
    generatePrompt: "/generate?tab=prompt",
    generateProduct: "/generate?tab=product",
    viewAllImages: "/products",
    viewAllProducts: "/products",
  };
  const stats = [
    { label: "Total Products", value: "24" },
    { label: "Images Generated", value: "156" },
    { label: "Templates Used", value: "18" },
    { label: "Ads Created", value: "12" },
  ];
  return (
    <DashboardUI
      recentImages={recentImages}
      recentProducts={recentProducts}
      stats={stats}
      links={links}
    />
  );
};

export default Dashboard;
