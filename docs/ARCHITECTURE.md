# Architecture — CV Matching Tool
**Version:** 1.1  
**Date:** 07 September 2025  

---

## 1. Component Diagram
```mermaid
flowchart LR
  subgraph Client["Browser (Next.js/React)"]
    UI1[CVs Tab]
    UI2[Profiles Tab]
    UI3[Matches Tab]
    UI4[Rewriting Tab]
  end

  subgraph FE["Frontend"]
    FE_API[/API Routes/]
  end

  subgraph BE["Backend (Express/TS)"]
    PARSE[Parsers]
    NORM[Normaliser]
    I18N[Translation Layer]
    MATCH[Matcher]
    REWRITE[Rewriter]
    INDEX[Indexer]
    EXPORT[PDF Composer]
  end

  subgraph FS["Filesystem Storage"]
    CAND[(candidates/*.json)]
    RAW[(raw-extract/*.raw.json)]
    RES[(results/*.json)]
    IND[(indices/*.json)]
    ORIG[(assets/originals)]
    GEN[(assets/generated)]
    BACK[(backups/*.tar.gz)]
  end

  subgraph AI["AI Connectors"]
    CLAUDE[Claude]
    GPT[ChatGPT]
    GEMINI[Gemini]
  end

  UI1-->FE-->BE
  UI2-->FE-->BE
  UI3-->FE-->BE
  UI4-->FE-->BE

  BE-->PARSE-->RAW
  BE-->NORM-->CAND
  BE-->I18N<-->AI
  BE-->MATCH-->RES
  BE-->INDEX-->IND
  BE-->REWRITE<-->AI
  BE-->EXPORT-->GEN
  ORIG<-->BE
  BACK---FS
