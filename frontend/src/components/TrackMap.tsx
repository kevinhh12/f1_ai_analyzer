

export default function TrackMap({ track, year }: { track: string; year: number }) {
    const trackMapURL = (track:string) => `https://media.formula1.com/image/upload/c_fit,h_704/q_auto/v1740000001/common/f1/${year}/track/${year}track${track}detailed.webp`;
    console.log(trackMapURL(track));

    return (
        <section id="trackmap" className='panel'>
            <div className="tm-canvas">
                <img src={trackMapURL(track)} alt="Track Map" />
            </div>
        </section>
    );
}