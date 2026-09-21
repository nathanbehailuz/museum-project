import styles from "./skeletons.module.css";

function Shimmer({ className }: { className: string }) {
  return <div className={`${styles.shimmer} ${className}`} aria-hidden="true" />;
}

function LiveLabel({ children }: { children: string }) {
  return <span className={styles.srOnly}>{children}</span>;
}

export function SearchSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <LiveLabel>Loading search</LiveLabel>
      <Shimmer className={styles.searchSkeleton} />
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className={styles.homeSkeleton} role="status" aria-busy="true">
      <LiveLabel>Loading archive</LiveLabel>
      <Shimmer className={styles.homeBrand} />
      <Shimmer className={styles.homeLine} />
      <Shimmer className={styles.homeLineShort} />
      <Shimmer className={styles.homeSearch} />
      <Shimmer className={styles.homeMap} />
      <div className={styles.homeRows}>
        <Shimmer className={styles.homeRow} />
        <Shimmer className={styles.homeRow} />
        <Shimmer className={styles.homeRow} />
      </div>
    </div>
  );
}

export function SubjectShellSkeleton() {
  return (
    <div className={styles.shellSkeleton} role="status" aria-busy="true">
      <LiveLabel>Loading subject</LiveLabel>
      <div className={styles.shellHeader}>
        <Shimmer className={styles.shellBrand} />
        <Shimmer className={styles.shellNav} />
        <Shimmer className={styles.shellSearch} />
      </div>
      <Shimmer className={styles.shellField} />
      <div className={styles.shellEpochs}>
        <Shimmer className={styles.shellEpoch} />
        <Shimmer className={styles.shellEpoch} />
        <Shimmer className={styles.shellEpoch} />
        <Shimmer className={styles.shellEpoch} />
      </div>
    </div>
  );
}

export function MapCanvasSkeleton() {
  return (
    <div role="status" aria-busy="true" style={{ width: "100%", height: "100%" }}>
      <LiveLabel>Loading map</LiveLabel>
      <Shimmer className={styles.mapSkeleton} />
    </div>
  );
}

export function InspectionSkeleton() {
  return (
    <div className={styles.inspectSkeleton} role="status" aria-busy="true">
      <LiveLabel>Loading artwork</LiveLabel>
      <Shimmer className={styles.inspectImage} />
      <Shimmer className={styles.inspectTitle} />
      <Shimmer className={styles.inspectLine} />
      <Shimmer className={styles.inspectLine} />
    </div>
  );
}
