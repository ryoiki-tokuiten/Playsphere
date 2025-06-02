import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import SetupPage from "@/pages/setup-page";
import SharePage from "@/pages/share-page";
import EditCardPage from "@/pages/edit-card";
import ChatPage from "@/pages/chat-page";
import SearchPage from "@/pages/search-page";
import WatchPage from "@/pages/watch-page";
import AdminDashboard from "@/pages/admin-dashboard";
import IdeasPage from "@/pages/ideas-page";
import { useEffect, useState } from "react";
import { Home as HomeIcon, Search, MessageCircle, Shield, PlayCircle, Lightbulb } from "lucide-react";
import AuthPage from './pages/auth-page';
import { useAuth } from "./hooks/use-auth";

function NavigationMenu() {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  
  // Determine active link based on current location
  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };
  
  return (
    <nav className="nav-menu">
      <div className="flex flex-col gap-8">
        <a href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
          <HomeIcon className="h-6 w-6" />
          <span>Home</span>
        </a>
        <a href="/search" className={`nav-item ${isActive('/search') ? 'active' : ''}`}>
          <Search className="h-6 w-6" />
          <span>Search</span>
        </a>
        <a href="/watch" className={`nav-item ${isActive('/watch') ? 'active' : ''}`}>
          <PlayCircle className="h-6 w-6" />
          <span>Watch</span>
        </a>
        <a href="/messages" className={`nav-item ${isActive('/messages') ? 'active' : ''}`}>
          <MessageCircle className="h-6 w-6" />
          <span>Chat</span>
        </a>
        <a href="/ideas" className={`nav-item ${isActive('/ideas') ? 'active' : ''}`}>
          <Lightbulb className="h-6 w-6" />
          <span>Ideas</span>
        </a>
        {isAdmin && (
          <a href="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
            <Shield className="h-6 w-6" />
            <span>Admin</span>
          </a>
        )}
      </div>
    </nav>
  );
}

function Router() {
  const { user, isAdmin, isAuthenticated, isLoading } = useAuth();
  console.log("Auth state:", { user, isAdmin, isAuthenticated, isLoading });

  if (isLoading) {
    console.log("Showing loading state");
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        <p>Loading...</p>
      </div>
    );
  }

  console.log("Current location:", window.location.pathname);
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <Switch>
        <Route path="/auth">
          {isAuthenticated ? <Redirect to="/" /> : <AuthPage />}
        </Route>
        <Route path="/setup">
          <SetupPage />
        </Route>
        <Route path="/">
          {!isAuthenticated ? (
            <Redirect to="/auth" />
          ) : (
            <HomePage />
          )}
        </Route>
        <Route path="/messages">
          {!isAuthenticated ? (
            <Redirect to="/auth" />
          ) : (
            <ChatPage />
          )}
        </Route>
        <Route path="/search">
          {!isAuthenticated ? (
            <Redirect to="/auth" />
          ) : (
            <SearchPage />
          )}
        </Route>
        <Route path="/watch">
          {!isAuthenticated ? (
            <Redirect to="/auth" />
          ) : (
            <WatchPage />
          )}
        </Route>
        <Route path="/ideas">
          {!isAuthenticated ? (
            <Redirect to="/auth" />
          ) : (
            <IdeasPage />
          )}
        </Route>
        <Route path="/admin">
          {!isAuthenticated || !isAdmin ? (
            <Redirect to="/" />
          ) : (
            <AdminDashboard />
          )}
        </Route>
        <Route path="/share/:username" component={SharePage} />
        <Route path="/edit" component={EditCardPage} />
        <Route component={NotFound} />
      </Switch>
      {isAuthenticated && <NavigationMenu />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}