"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string | null;
}

interface ApiResponse {
  success: boolean;
  count: number;
  data: Member[];
}

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch("/api/users");
        const data: ApiResponse = await response.json();

        if (data.success) {
          setMembers(data.data);
        } else {
          setError("Erreur lors du chargement des membres");
        }
      } catch (err) {
        setError("Impossible de se connecter à l'API");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left w-full">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Dashboard - Gestion de Gym
          </h1>
          
          <div className="w-full mt-8">
            <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
              Membres inscrits ({members.length})
            </h2>
            
            {loading && (
              <p className="text-zinc-600 dark:text-zinc-400">
                Chargement des membres...
              </p>
            )}
            
            {error && (
              <p className="text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            
            {!loading && !error && members.length === 0 && (
              <p className="text-zinc-600 dark:text-zinc-400">
                Aucun membre trouvé dans la base de données.
              </p>
            )}
            
            {!loading && !error && members.length > 0 && (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <p className="font-medium text-black dark:text-zinc-50">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      ID: {member.id.slice(0, 8)}...
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="/api/users"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir API
          </a>
        </div>
      </main>
    </div>
  );
}
