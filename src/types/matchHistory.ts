export interface MatchHistory {
    id: string;
  
    courtId: number;
  
    teamA: [string, string];
  
    teamB: [string, string];
  
    startedAt: Date;
  
    endedAt: Date;
  
    teamAScore?: number;

    teamBScore?: number;
  }
