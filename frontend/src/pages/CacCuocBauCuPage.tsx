import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchCacCuocBauCu } from '../store/slice/cuocBauCuSlice';
import ElectionCard from '../features/CardCuocBauCu';
import SEO from '../components/SEO';
import ThongBaoKhongCoCuocBauCu from '../components/ThongBaoKhongCoCuocBauCu';
import { Loader } from '../components/ui/clay';

const CacCuocBauCuPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const cacCuocBauCu = useSelector((state: RootState) => state.cuocBauCu.cacCuocBauCu);
  const dangTai = useSelector((state: RootState) => state.cuocBauCu.dangTai);
  const loi = useSelector((state: RootState) => state.cuocBauCu.loi);

  useEffect(() => {
    dispatch(fetchCacCuocBauCu());
  }, [dispatch]);

  useEffect(() => {
    if (loi) {
      return;
    }
  }, [loi, navigate]);

  function locCacCuocBauCu() {
    const search = searchParams.get('search');
    if (search === null || search === '') {
      return cacCuocBauCu;
    } else {
      return cacCuocBauCu.filter(
        (cuocBauCu) => cuocBauCu.tenCuocBauCu.toLowerCase().indexOf(search.toLowerCase()) > -1,
      );
    }
  }

  const filteredElections = locCacCuocBauCu();

  return (
    <>
      <SEO
        title="Danh sách các cuộc bầu cử | Nền Tảng Bầu Cử Blockchain"
        description="Trang danh sách các cuộc bầu cử trên hệ thống Bầu Cử Blockchain."
        keywords="Bầu cử, Blockchain, Cuộc bầu cử, Danh sách cuộc bầu cử"
        author="Nền Tảng Bầu Cử Blockchain"
        url={window.location.href}
        image={`${window.location.origin}/logo.png`}
      />
      <div className="min-h-screen bg-[var(--clay-bg)] p-5 text-[var(--clay-text)] sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1440px]">
          <h1 className="mb-6 text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
            Các cuộc bầu cử
          </h1>
          {dangTai ? (
            <div className="flex justify-center py-16">
              <Loader label="Đang tải danh sách…" />
            </div>
          ) : filteredElections.length === 0 ? (
            <ThongBaoKhongCoCuocBauCu />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredElections.map((cuocBauCu) => (
                <ElectionCard key={cuocBauCu.id} election={cuocBauCu} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CacCuocBauCuPage;
